import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const AUTENTIQUE_ENDPOINT = "https://api.autentique.com.br/v2/graphql";

type Supa = SupabaseClient<Database>;
type ContractRow = Database["public"]["Tables"]["transactions"]["Row"];

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
    // 0) Termos vigentes aceitos
    const { TERMS_VERSION } = await import("@/lib/terms");
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("accepted_terms_version")
      .eq("id", context.userId)
      .maybeSingle();
    if (profile?.accepted_terms_version !== TERMS_VERSION) {
      throw new Error("Aceite os novos termos pra continuar.");
    }

    // 1) Guard de assinatura
    const { data: hasSub, error: subErr } = await context.supabase
      .rpc("has_active_subscription", { _user_id: context.userId });
    if (subErr) throw new Error(subErr.message);
    if (!hasSub) {
      throw new Error("Sua assinatura não está ativa. Acesse /assinatura para regularizar.");
    }

    // 2) Rate-limit (10 contratos por minuto por usuário)
    const { checkRateLimit } = await import("@/lib/rate-limit.server");
    const rl = await checkRateLimit({
      userId: context.userId,
      action: "create_contract",
      windowSeconds: 60,
      max: 10,
    });
    if (!rl.ok) throw new Error("Muitos contratos em sequência. Aguarde 1 minuto.");

    // 3) Anti-abuso interno (teto alto, não-comercial)
    const { data: count } = await context.supabase.rpc("current_month_transaction_count");
    const { data: sub } = await context.supabase
      .from("subscriptions")
      .select("monthly_contract_quota")
      .eq("user_id", context.userId)
      .maybeSingle();
    const ceil = sub?.monthly_contract_quota ?? 2000;
    if ((count ?? 0) >= ceil) {
      throw new Error("Uso anormal detectado. Tente novamente mais tarde.");
    }


    const { data: row, error } = await context.supabase
      .from("transactions")
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
      .from("transactions")
      .select(
        "id,title,client_name,client_email,status,autentique_signers,sent_at,signed_at,last_error,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { contracts: data ?? [] };
  });

export const getContract = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ contractId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: contract, error } = await context.supabase
      .from("transactions")
      .select("*")
      .eq("id", data.contractId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!contract) throw new Error("NOT_FOUND");

    const { data: events, error: evErr } = await context.supabase
      .from("contract_events")
      .select("id,event_type,status,signer_email,message,created_at")
      .eq("contract_id", contract.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (evErr) throw new Error(evErr.message);

    return { contract, events: events ?? [] };
  });

export const sendContractToAutentique = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ contractId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: hasSub } = await context.supabase
      .rpc("has_active_subscription", { _user_id: context.userId });
    if (!hasSub) throw new Error("Sua assinatura não está ativa.");

    const { data: contract, error } = await context.supabase
      .from("transactions")
      .select("*")
      .eq("id", data.contractId)
      .single();
    if (error || !contract) throw new Error("Contrato não encontrado.");
    if (contract.status !== "draft" || contract.autentique_document_id) {
      throw new Error("Este contrato já foi enviado.");
    }
    return await dispatchToAutentique(contract, context.supabase);
  });

export const resendContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ contractId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: contract, error } = await context.supabase
      .from("transactions")
      .select("*")
      .eq("id", data.contractId)
      .single();
    if (error || !contract) throw new Error("Contrato não encontrado.");
    if (contract.status !== "error") {
      throw new Error("Só é possível reenviar contratos com erro.");
    }

    // Reseta o contrato para draft e limpa dados do envio anterior
    const { error: resetErr } = await context.supabase
      .from("transactions")
      .update({
        status: "draft",
        autentique_document_id: null,
        autentique_signers: null,
        sent_at: null,
        last_error: null,
      })
      .eq("id", contract.id);
    if (resetErr) throw new Error(resetErr.message);

    await context.supabase.from("contract_events").insert({
      contract_id: contract.id,
      event_type: "resend_requested",
      status: "draft",
      message: "Reenvio solicitado pelo usuário",
    });

    const fresh = { ...contract, status: "draft", autentique_document_id: null };
    return await dispatchToAutentique(fresh, context.supabase);
  });

// ----- helper compartilhado -----

async function dispatchToAutentique(contract: ContractRow, supabase: Supa) {
  const token = process.env.AUTENTIQUE_API_TOKEN;
  if (!token) throw new Error("AUTENTIQUE_API_TOKEN não configurado.");

  // PDF deve ter sido gerado previamente pelo chat-agente (gerarPdfContrato)
  if (!contract.pdf_path) {
    throw new Error("Gere o PDF do contrato antes de enviar para assinatura.");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: blob, error: dlErr } = await supabaseAdmin
    .storage.from("contract-pdfs").download(contract.pdf_path);
  if (dlErr || !blob) throw new Error("Não foi possível carregar o PDF do contrato.");
  const pdfBytes = new Uint8Array(await blob.arrayBuffer());

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

  const recordError = async (message: string) => {
    await supabase
      .from("transactions")
      .update({ status: "error", last_error: message.slice(0, 1000) })
      .eq("id", contract.id);
    await supabase.from("contract_events").insert({
      contract_id: contract.id,
      event_type: "send_failed",
      status: "error",
      message: message.slice(0, 1000),
    });
  };

  let result: {
    data?: {
      createDocument?: {
        id: string;
        signatures?: Array<{
          public_id?: string;
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
    await recordError(message);
    throw new Error(`Falha ao enviar pra Autentique: ${message}`);
  }

  if (result.errors?.length) {
    const message = result.errors.map((e) => e.message).join("; ");
    await recordError(message);
    throw new Error(`Autentique: ${message}`);
  }

  const doc = result.data?.createDocument;
  if (!doc?.id) {
    await recordError("Resposta inválida da Autentique");
    throw new Error("Resposta inválida da Autentique.");
  }

  const signers = (doc.signatures ?? []).map((s) => ({
    public_id: s.public_id ?? null,
    name: s.name ?? null,
    email: s.email ?? null,
    link: s.link?.short_link ?? null,
    signed_at: null as string | null,
    rejected_at: null as string | null,
  }));

  await supabase
    .from("transactions")
    .update({
      status: "sent",
      autentique_document_id: doc.id,
      autentique_signers: signers,
      sent_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", contract.id);

  await supabase.from("contract_events").insert({
    contract_id: contract.id,
    event_type: "sent",
    status: "sent",
    message: `Documento criado na Autentique (${doc.id})`,
  });

  return { documentId: doc.id, signers };
}
