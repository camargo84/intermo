// Helper de integração com a Autentique focado em organização por tenant.
//
// O fluxo white-label do inTermo mantém a página de assinatura sob nosso próprio
// domínio (/assinar/:token). A Autentique é usada em paralelo, de forma invisível
// para o cliente final, como cofre/custódia jurídica. Para manter a casa do
// lojista organizada, cada tenant tem uma PASTA própria na conta Autentique,
// cujo id fica em profiles.autentique_folder_id.
//
// IMPORTANTE (schema real): os nomes de mutation/campos abaixo (createFolder,
// moveDocumentToFolder, folder_id) seguem a convenção da API v2 da Autentique,
// mas o schema GraphQL real pode divergir. Há TODOs marcando onde confirmar
// contra a documentação oficial antes de produção.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const AUTENTIQUE_ENDPOINT = "https://api.autentique.com.br/v2/graphql";

type Supa = SupabaseClient<Database>;
type ContractRow = Database["public"]["Tables"]["transactions"]["Row"];

function authToken(): string | null {
  return process.env.AUTENTIQUE_API_TOKEN ?? null;
}

/**
 * Garante que o tenant (userId) tenha uma pasta na Autentique e retorna o id dela.
 * - Lê profiles.autentique_folder_id; se já existir, retorna sem custo.
 * - Senão, cria a pasta via GraphQL, persiste o id e retorna.
 * - Degrada graciosamente: sem token ou em qualquer falha de rede/schema,
 *   retorna null SEM lançar — o envio do contrato nunca deve quebrar por causa
 *   da organização em pastas.
 */
export async function ensureTenantFolder(userId: string, supabase: Supa): Promise<string | null> {
  const token = authToken();
  if (!token) return null;

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "autentique_folder_id, company_legal_name, company_fantasy_name, company_email, owner_name",
      )
      .eq("id", userId)
      .maybeSingle();

    if (profile?.autentique_folder_id) return profile.autentique_folder_id;

    const folderName =
      profile?.company_legal_name ||
      profile?.company_fantasy_name ||
      profile?.owner_name ||
      profile?.company_email ||
      "Cliente";

    // TODO(autentique-schema): confirmar nome da mutation e do input.
    // A doc v2 expõe createFolder(folder: FolderInput!) { id name }.
    const mutation = `
      mutation CreateFolderMutation($folder: FolderInput!) {
        createFolder(folder: $folder) { id name }
      }
    `;
    const res = await fetch(AUTENTIQUE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: mutation,
        variables: { folder: { name: `inTermo – ${folderName}` } },
      }),
    });
    if (!res.ok) return null;
    const jsonRes = (await res.json()) as {
      data?: { createFolder?: { id?: string } };
      errors?: Array<{ message?: string }>;
    };
    if (jsonRes.errors?.length) return null;
    const folderId = jsonRes.data?.createFolder?.id ?? null;
    if (!folderId) return null;

    await supabase.from("profiles").update({ autentique_folder_id: folderId }).eq("id", userId);

    return folderId;
  } catch {
    // Falha silenciosa: organização em pasta é best-effort.
    return null;
  }
}

/**
 * Move um documento já criado para a pasta do tenant. Best-effort: erros não
 * são propagados. Usado quando o createDocument não aceita folder_id inline.
 *
 * TODO(autentique-schema): confirmar mutation moveDocumentToFolder(document_id, folder_id).
 */
export async function moveDocumentToFolder(documentId: string, folderId: string): Promise<void> {
  const token = authToken();
  if (!token) return;
  try {
    const mutation = `
      mutation MoveDocument($document_id: UUID!, $folder_id: UUID!) {
        moveDocumentToFolder(document_id: $document_id, folder_id: $folder_id) { id }
      }
    `;
    await fetch(AUTENTIQUE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: mutation,
        variables: { document_id: documentId, folder_id: folderId },
      }),
    });
  } catch {
    // best-effort
  }
}

/**
 * Cria o documento na Autentique já dentro da pasta do tenant.
 *
 * Mantém o MESMO contrato de retorno de dispatchToAutentique (documentId +
 * signers) para ser usado de forma intercambiável. A organização por pasta é
 * aplicada após a criação via moveDocumentToFolder, que é a forma mais robusta
 * (não depende de o createDocument aceitar folder_id inline).
 *
 * Observação: este helper NÃO escreve em transactions/contract_events — quem
 * orquestra o envio (contracts.functions.ts) é responsável pela persistência.
 * Aqui só falamos com a API externa.
 */
export async function createDocumentInTenantFolder({
  contract,
  folderId,
  pdfBytes,
}: {
  contract: Pick<ContractRow, "title" | "client_email" | "client_name">;
  folderId: string | null;
  pdfBytes: Uint8Array;
}): Promise<{
  documentId: string;
  signatures: Array<{
    public_id?: string;
    name?: string;
    email?: string;
    link?: { short_link?: string } | null;
  }>;
}> {
  const token = authToken();
  if (!token) throw new Error("AUTENTIQUE_API_TOKEN não configurado.");

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
      signers: [{ email: contract.client_email, action: "SIGN", name: contract.client_name }],
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

  const res = await fetch(AUTENTIQUE_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Autentique HTTP ${res.status}: ${text}`);
  const result = JSON.parse(text) as {
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
  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }
  const doc = result.data?.createDocument;
  if (!doc?.id) throw new Error("Resposta inválida da Autentique.");

  // Organiza na pasta do tenant (best-effort, não quebra o envio).
  if (folderId) {
    await moveDocumentToFolder(doc.id, folderId);
  }

  return { documentId: doc.id, signatures: doc.signatures ?? [] };
}
