import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AUTENTIQUE_ENDPOINT = "https://api.autentique.com.br/v2/graphql";

const createContractSchema = z.object({
  title: z.string().min(2).max(200),
  content: z.string().min(10).max(20000),
  clientName: z.string().min(2).max(160),
  clientEmail: z.string().email().max(200),
  clientDoc: z.string().max(40).optional().nullable(),
  valueCents: z.number().int().nonnegative().optional().nullable(),
});

export const createContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createContractSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("contracts")
      .insert({
        user_id: context.userId,
        title: data.title,
        content: data.content,
        client_name: data.clientName,
        client_email: data.clientEmail,
        client_doc: data.clientDoc ?? null,
        value_cents: data.valueCents ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const listContracts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contracts")
      .select(
        "id,title,client_name,client_email,status,autentique_signers,sent_at,signed_at,last_error,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { contracts: data ?? [] };
  });

export const sendContractToAutentique = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ contractId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const token = process.env.AUTENTIQUE_API_TOKEN;
    if (!token) throw new Error("AUTENTIQUE_API_TOKEN não configurado.");

    const { data: contract, error } = await context.supabase
      .from("contracts")
      .select("*")
      .eq("id", data.contractId)
      .single();
    if (error || !contract) throw new Error("Contrato não encontrado.");
    if (contract.status !== "draft" || contract.autentique_document_id) {
      throw new Error("Este contrato já foi enviado.");
    }

    // Dynamic import: pdf-lib é pesado e só roda no server
    const { renderContractPdf } = await import("./contracts.pdf.server");
    const pdfBytes = await renderContractPdf({
      title: contract.title,
      content: contract.content,
      clientName: contract.client_name,
      clientEmail: contract.client_email,
      clientDoc: contract.client_doc,
      valueCents: contract.value_cents,
    });

    const mutation = `
      mutation CreateDocumentMutation(
        $document: DocumentInput!,
        $signers: [SignerInput!]!,
        $file: Upload!
      ) {
        createDocument(document: $document, signers: $signers, file: $file) {
          id
          name
          signatures {
            public_id
            name
            email
            action { name }
            link { short_link }
          }
        }
      }
    `;

    const operations = {
      query: mutation,
      variables: {
        document: { name: contract.title },
        signers: [
          {
            email: contract.client_email,
            action: "SIGN",
            name: contract.client_name,
          },
        ],
        file: null,
      },
    };

    const form = new FormData();
    form.append("operations", JSON.stringify(operations));
    form.append("map", JSON.stringify({ "0": ["variables.file"] }));
    form.append(
      "0",
      new Blob([pdfBytes as BlobPart], { type: "application/pdf" }),
      `${contract.title.replace(/[^\w\s-]/g, "").slice(0, 80) || "contrato"}.pdf`,
    );

    let result: {
      data?: {
        createDocument?: {
          id: string;
          signatures?: Array<{
            name?: string;
            email?: string;
            link?: { short_link?: string } | null;
          }>;
        };
      };
      errors?: Array<{ message: string }>;
    };
    try {
      const res = await fetch(AUTENTIQUE_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`Autentique HTTP ${res.status}: ${text}`);
      result = JSON.parse(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await context.supabase
        .from("contracts")
        .update({ status: "error", last_error: message.slice(0, 1000) })
        .eq("id", contract.id);
      throw new Error(`Falha ao enviar pra Autentique: ${message}`);
    }

    if (result.errors?.length) {
      const message = result.errors.map((e) => e.message).join("; ");
      await context.supabase
        .from("contracts")
        .update({ status: "error", last_error: message.slice(0, 1000) })
        .eq("id", contract.id);
      throw new Error(`Autentique: ${message}`);
    }

    const doc = result.data?.createDocument;
    if (!doc?.id) {
      await context.supabase
        .from("contracts")
        .update({ status: "error", last_error: "Resposta inválida da Autentique" })
        .eq("id", contract.id);
      throw new Error("Resposta inválida da Autentique.");
    }

    const signers = (doc.signatures ?? []).map((s) => ({
      name: s.name ?? null,
      email: s.email ?? null,
      link: s.link?.short_link ?? null,
    }));

    await context.supabase
      .from("contracts")
      .update({
        status: "sent",
        autentique_document_id: doc.id,
        autentique_signers: signers,
        sent_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", contract.id);

    return { documentId: doc.id, signers };
  });
