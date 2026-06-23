// Custódia Autentique pós-assinatura whitelabel (opção B).
//
// Quando todas as partes assinarem pelo nosso domínio (/assinar/$token), o PDF
// original e as evidências locais (signature_tokens) já têm validade jurídica
// por MP 2.200-2/2001. Para reforço probatório, esse helper sobe o PDF para a
// Autentique como documento de arquivamento — assim a empresa também tem uma
// cópia espelhada na custódia da Autentique, com folha de auditoria.
//
// Importante: a Autentique não tem endpoint para "marcar signatário como já
// assinado externamente". Optamos por subir o PDF com um único signatário
// (o representante legal do lojista, por email) com action=SIGN. A Autentique
// envia o link por email e devolve `short_link` que persistimos. Quando o
// lojista clica e assina lá, o doc fecha definitivamente como custódia.
// Em paralelo, a prova jurídica primária continua sendo a tabela
// signature_tokens (IP, user-agent, hash do PDF, imagem PNG).
//
// Best-effort: qualquer falha aqui NÃO invalida a assinatura whitelabel já
// gravada. Apenas logamos `custody_failed` em contract_events.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const AUTENTIQUE_ENDPOINT = "https://api.autentique.com.br/v2/graphql";

type Supa = SupabaseClient<Database>;

export async function pushContractToCustody(
  contractId: string,
  supabase: Supa,
): Promise<{ ok: true; documentId: string } | { ok: false; reason: string }> {
  const token = process.env.AUTENTIQUE_API_TOKEN;
  if (!token) return { ok: false, reason: "AUTENTIQUE_API_TOKEN ausente" };

  const { data: contract } = await supabase
    .from("transactions")
    .select(
      "id,user_id,title,client_name,client_email,pdf_path,autentique_custody_document_id",
    )
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) return { ok: false, reason: "contrato não encontrado" };
  if (contract.autentique_custody_document_id) {
    return { ok: true, documentId: contract.autentique_custody_document_id };
  }
  if (!contract.pdf_path) return { ok: false, reason: "PDF do contrato ausente" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_legal_name,company_fantasy_name,owner_name,company_email,autentique_folder_id")
    .eq("id", contract.user_id)
    .maybeSingle();

  const lojistaEmail = profile?.company_email;
  const lojistaName =
    profile?.company_legal_name ||
    profile?.company_fantasy_name ||
    profile?.owner_name ||
    "Lojista";
  if (!lojistaEmail) {
    return { ok: false, reason: "email do lojista ausente em profiles.company_email" };
  }

  // Garante pasta do tenant (best-effort).
  let folderId = profile?.autentique_folder_id ?? null;
  if (!folderId) {
    try {
      const { ensureTenantFolder } = await import("@/lib/autentique.server");
      folderId = await ensureTenantFolder(contract.user_id, supabase);
    } catch {
      folderId = null;
    }
  }

  // Baixa o PDF original do storage privado.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: blob, error: dlErr } = await supabaseAdmin.storage
    .from("contract-pdfs")
    .download(contract.pdf_path);
  if (dlErr || !blob) return { ok: false, reason: "falha ao baixar PDF" };
  const pdfBytes = new Uint8Array(await blob.arrayBuffer());

  // Monta multipart GraphQL para createDocument.
  const mutation = `
    mutation CreateCustodyDocument(
      $document: DocumentInput!,
      $signers: [SignerInput!]!,
      $file: Upload!,
      $folder_id: String
    ) {
      createDocument(document: $document, signers: $signers, file: $file, folder_id: $folder_id) {
        id
        signatures { public_id name email link { short_link } }
      }
    }
  `;
  const operations = {
    query: mutation,
    variables: {
      document: {
        name: `[Custódia] ${contract.title}`,
        message: "Cópia de custódia. As partes já assinaram pelo inTermo.",
      },
      signers: [{ email: lojistaEmail, name: lojistaName, action: "SIGN" }],
      file: null,
      folder_id: folderId,
    },
  };

  const form = new FormData();
  form.append("operations", JSON.stringify(operations));
  form.append("map", JSON.stringify({ "0": ["variables.file"] }));
  form.append(
    "0",
    new Blob([pdfBytes as BlobPart], { type: "application/pdf" }),
    `custodia-${contract.id}.pdf`,
  );

  let docId: string | null = null;
  try {
    const res = await fetch(AUTENTIQUE_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    const parsed = JSON.parse(text) as {
      data?: { createDocument?: { id: string } };
      errors?: Array<{ message: string }>;
    };
    if (parsed.errors?.length) {
      return { ok: false, reason: parsed.errors.map((e) => e.message).join("; ") };
    }
    docId = parsed.data?.createDocument?.id ?? null;
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }

  if (!docId) return { ok: false, reason: "Autentique não devolveu id" };

  await supabase
    .from("transactions")
    .update({ autentique_custody_document_id: docId })
    .eq("id", contract.id);

  await supabase.from("contract_events").insert({
    contract_id: contract.id,
    event_type: "custody_archived",
    status: null,
    message: `Cópia de custódia criada na Autentique (${docId})`,
  });

  return { ok: true, documentId: docId };
}
