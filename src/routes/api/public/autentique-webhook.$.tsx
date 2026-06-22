import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import {
  buildPatch,
  computeEventFingerprint,
  extractEventType,
  shouldFetchSignedPdf,
  type AutentiquePayload,
  type SignerRecord,
} from "@/lib/autentique-webhook.logic";

export const Route = createFileRoute("/api/public/autentique-webhook/$")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const expected = process.env.AUTENTIQUE_WEBHOOK_SECRET;
        if (!expected) {
          return json({ error: "webhook não configurado" }, 500);
        }

        // Prefer secret via Authorization header (Bearer) or X-Autentique-Token.
        // URL-path secret kept only as backward-compat fallback during migration.
        const authHeader = request.headers.get("authorization") ?? "";
        const bearer = authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7).trim()
          : "";
        const headerToken = bearer || (request.headers.get("x-autentique-token") ?? "").trim();
        const pathToken = (params._splat ?? "").trim();
        const provided = headerToken || pathToken;

        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return json({ error: "unauthorized" }, 401);
        }

        let body: AutentiquePayload;
        try {
          body = (await request.json()) as AutentiquePayload;
        } catch {
          return json({ error: "invalid json" }, 400);
        }

        const eventType = extractEventType(body) || "unknown";
        const documentId =
          body.document?.id ?? body.partner?.document_id ?? body.document_id ?? null;
        if (!documentId) {
          return json({ ok: true, ignored: "no document id" });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: contract, error: fetchErr } = await supabaseAdmin
            .from("transactions")
            .select("id,user_id,status,autentique_signers,signed_pdf_path")
            .eq("autentique_document_id", documentId)
            .maybeSingle();
          if (fetchErr) throw fetchErr;
          if (!contract) {
            return json({ ok: true, ignored: "unknown document" });
          }

          const currentSigners = Array.isArray(contract.autentique_signers)
            ? (contract.autentique_signers as SignerRecord[])
            : [];
          const patch = buildPatch({
            eventType,
            body,
            currentSigners,
            currentStatus: contract.status as string | null,
          });

          if (Object.keys(patch).length > 0) {
            const { error: updateErr } = await supabaseAdmin
              .from("transactions")
              .update(patch as never)
              .eq("id", contract.id);
            if (updateErr) throw updateErr;
          }

          // Registra o evento no histórico de forma idempotente. A Autentique
          // reentrega webhooks; o fingerprint determinístico (ver
          // computeEventFingerprint) é a chave: onConflict + ignoreDuplicates
          // faz a 2ª entrega do MESMO evento ser descartada sem erro, mantendo
          // a trilha de auditoria limpa. Eventos sem fingerprint (não deveria
          // ocorrer aqui, pois documentId já foi validado) caem no insert comum.
          const eventFingerprint = computeEventFingerprint({
            documentId,
            eventType,
            body,
          });
          await supabaseAdmin.from("contract_events").upsert(
            {
              contract_id: contract.id,
              event_type: eventType,
              status: patch.status ?? null,
              signer_email: body.signature?.email ?? null,
              message: null,
              payload: JSON.parse(JSON.stringify(body)),
              event_fingerprint: eventFingerprint as any,
            } as any,
            { onConflict: "event_fingerprint", ignoreDuplicates: true },
          );

          // Quando o contrato está assinado e ainda não temos o PDF arquivado,
          // baixar da Autentique. Ver shouldFetchSignedPdf para a regra (cobre
          // reenvio do "signed" após falha de download). Idempotente.
          if (
            shouldFetchSignedPdf({
              patchStatus: patch.status,
              currentStatus: contract.status as string | null,
              signedPdfPath: contract.signed_pdf_path as string | null,
            })
          ) {
            try {
              await fetchAndStoreSignedPdf({
                supabaseAdmin,
                contractId: contract.id,
                userId: contract.user_id as string,
                documentId,
              });
            } catch (pdfErr) {
              const msg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
              console.error("[autentique-webhook] signed-pdf fetch failed", msg);
              await supabaseAdmin.from("contract_events").insert({
                contract_id: contract.id,
                event_type: "signed_pdf_fetch_failed",
                status: null,
                signer_email: null,
                message: msg,
                payload: null,
              });
              // não retorna 500 — webhook já foi processado
            }
          }

          return json({ ok: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[autentique-webhook]", message);
          return json({ error: "internal", message }, 500);
        }
      },
    },
  },
});

// ----- baixar e armazenar PDF assinado da Autentique -----

const AUTENTIQUE_ENDPOINT = "https://api.autentique.com.br/v2/graphql";

type AdminClient = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

async function fetchAndStoreSignedPdf({
  supabaseAdmin,
  contractId,
  userId,
  documentId,
}: {
  supabaseAdmin: AdminClient;
  contractId: string;
  userId: string;
  documentId: string;
}) {
  const token = process.env.AUTENTIQUE_API_TOKEN;
  if (!token) throw new Error("AUTENTIQUE_API_TOKEN ausente");

  // 1) Buscar URL temporária do PDF assinado
  const query = `query($id: UUID!) { document(id: $id) { id files { signed } } }`;
  const gqlRes = await fetch(AUTENTIQUE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables: { id: documentId } }),
  });
  if (!gqlRes.ok) {
    throw new Error(`Autentique GraphQL HTTP ${gqlRes.status}`);
  }
  const gqlJson = (await gqlRes.json()) as {
    data?: { document?: { files?: { signed?: string | null } | null } | null };
    errors?: Array<{ message?: string }>;
  };
  if (gqlJson.errors?.length) {
    throw new Error(gqlJson.errors.map((e) => e.message).join("; "));
  }
  const signedUrl = gqlJson.data?.document?.files?.signed ?? null;
  if (!signedUrl) throw new Error("Autentique não retornou URL do PDF assinado");

  // 2) Baixar o PDF
  const pdfRes = await fetch(signedUrl);
  if (!pdfRes.ok) {
    throw new Error(`Download do PDF assinado falhou: HTTP ${pdfRes.status}`);
  }
  const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());

  // 3) Armazenar no bucket privado
  const path = `${userId}/${contractId}-signed.pdf`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("contract-pdfs")
    .upload(path, pdfBytes, {
      upsert: true,
      contentType: "application/pdf",
    });
  if (upErr) throw new Error(upErr.message);

  // 4) Marcar no contrato
  const { error: updErr } = await supabaseAdmin
    .from("transactions")
    .update({
      signed_pdf_path: path,
      signed_pdf_downloaded_at: new Date().toISOString(),
    } as never)
    .eq("id", contractId);
  if (updErr) throw new Error(updErr.message);

  // 5) Log
  await supabaseAdmin.from("contract_events").insert({
    contract_id: contractId,
    event_type: "signed_pdf_stored",
    status: "signed",
    signer_email: null,
    message: "PDF assinado baixado da Autentique e armazenado.",
    payload: null,
  });
}

// ----- helpers -----

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
