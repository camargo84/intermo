import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Supa = SupabaseClient<Database>;
type ContractRow = Database["public"]["Tables"]["transactions"]["Row"];

const AUTENTIQUE_ENDPOINT = "https://api.autentique.com.br/v2/graphql";

/**
 * Envia o PDF de um contrato (já gerado e salvo em storage) para a Autentique,
 * persiste o documento criado em `transactions` e devolve o id do documento e
 * os signatários (com link curto). Lança Error em caso de falha — o caller é
 * responsável por traduzir para mensagem amigável.
 */
export async function dispatchContractToAutentique(
  contract: ContractRow,
  supabase: Supa,
) {
  const token = process.env.AUTENTIQUE_API_TOKEN;
  if (!token) throw new Error("AUTENTIQUE_API_TOKEN não configurado.");

  if (!contract.pdf_path) {
    throw new Error("Gere o PDF do contrato antes de enviar para assinatura.");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: blob, error: dlErr } = await supabaseAdmin.storage
    .from("contract-pdfs")
    .download(contract.pdf_path);
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

  // Organiza o documento na pasta do tenant (best-effort).
  try {
    const { ensureTenantFolder, moveDocumentToFolder } = await import("@/lib/autentique.server");
    const folderId = await ensureTenantFolder(contract.user_id, supabase);
    if (folderId) await moveDocumentToFolder(doc.id, folderId);
  } catch {
    // organização em pasta é complementar; ignora falhas
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
