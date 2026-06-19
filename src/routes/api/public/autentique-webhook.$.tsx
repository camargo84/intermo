import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

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
        const headerToken =
          bearer || (request.headers.get("x-autentique-token") ?? "").trim();
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
          body.document?.id ??
          body.partner?.document_id ??
          body.document_id ??
          null;
        if (!documentId) {
          return json({ ok: true, ignored: "no document id" });
        }

        try {
          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );
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
          const patch = buildPatch({ eventType, body, currentSigners });

          if (Object.keys(patch).length > 0) {
            const { error: updateErr } = await supabaseAdmin
              .from("transactions")
              .update(patch as never)
              .eq("id", contract.id);
            if (updateErr) throw updateErr;
          }

          // Registra o evento no histórico, sempre
          await supabaseAdmin.from("contract_events").insert({
            contract_id: contract.id,
            event_type: eventType,
            status: patch.status ?? null,
            signer_email: body.signature?.email ?? null,
            message: typeof body === "object" ? null : null,
            payload: JSON.parse(JSON.stringify(body)),
          });

          // Quando todos assinaram, baixar PDF assinado da Autentique e armazenar.
          // Idempotente: pula se signed_pdf_path já existe.
          if (patch.status === "signed" && !contract.signed_pdf_path) {
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

type AdminClient = typeof import("@/integrations/supabase/client.server")["supabaseAdmin"];


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

interface AutentiquePayload {
  event?: { type?: string } | string;
  type?: string;
  document?: {
    id?: string;
    name?: string;
    signatures?: Array<RawSignature>;
  };
  signature?: RawSignature;
  partner?: { document_id?: string };
  document_id?: string;
}

interface RawSignature {
  public_id?: string;
  name?: string;
  email?: string;
  signed_at?: string | null;
  rejected_at?: string | null;
  viewed_at?: string | null;
  link?: { short_link?: string } | string | null;
  action?: { name?: string } | string;
}

interface SignerRecord {
  public_id?: string | null;
  name?: string | null;
  email?: string | null;
  link?: string | null;
  signed_at?: string | null;
  rejected_at?: string | null;
}

function extractEventType(body: AutentiquePayload): string {
  if (typeof body.event === "string") return body.event;
  if (body.event && typeof body.event === "object" && body.event.type)
    return body.event.type;
  if (typeof body.type === "string") return body.type;
  return "";
}

function normalizeSigner(raw: RawSignature): SignerRecord {
  const link =
    typeof raw.link === "string" ? raw.link : (raw.link?.short_link ?? null);
  return {
    public_id: raw.public_id ?? null,
    name: raw.name ?? null,
    email: raw.email ?? null,
    link,
    signed_at: raw.signed_at ?? null,
    rejected_at: raw.rejected_at ?? null,
  };
}

function mergeSigners(
  current: SignerRecord[],
  body: AutentiquePayload,
): SignerRecord[] | null {
  // Snapshot completo do documento, se vier
  if (body.document?.signatures?.length) {
    const incoming = body.document.signatures.map(normalizeSigner);
    // Se já temos signers conhecidos, preservar campos não vindos no snapshot
    if (!current.length) return incoming;
    return incoming.map((inc) => {
      const prev = current.find(
        (s) =>
          (inc.public_id && s.public_id === inc.public_id) ||
          (inc.email && s.email === inc.email),
      );
      return prev ? { ...prev, ...inc } : inc;
    });
  }
  // Patch de um único signatário
  if (body.signature) {
    const incoming = normalizeSigner(body.signature);
    const key = incoming.public_id ?? incoming.email;
    if (!key) return null;
    const next = current.length ? [...current] : [];
    const idx = next.findIndex(
      (s) =>
        (incoming.public_id && s.public_id === incoming.public_id) ||
        (incoming.email && s.email === incoming.email),
    );
    if (idx >= 0) {
      next[idx] = { ...next[idx], ...incoming };
    } else {
      next.push(incoming);
    }
    return next;
  }
  return null;
}

interface ContractPatch {
  status?: string;
  signed_at?: string | null;
  last_error?: string | null;
  autentique_signers?: SignerRecord[];
}

function buildPatch({
  eventType,
  body,
  currentSigners,
}: {
  eventType: string;
  body: AutentiquePayload;
  currentSigners: SignerRecord[];
}): ContractPatch {
  const patch: ContractPatch = {};
  const merged = mergeSigners(currentSigners, body);
  const effective = merged ?? currentSigners;
  if (merged) patch.autentique_signers = merged;

  const ev = eventType.toLowerCase();

  if (ev.includes("rejected")) {
    patch.status = "rejected";
  } else if (ev.includes("expired")) {
    patch.status = "expired";
  } else if (ev.includes("deleted")) {
    patch.status = "error";
    patch.last_error = "Documento removido na Autentique";
  } else if (ev.includes("signed")) {
    // Só marca contrato como assinado quando TODOS os signatários assinaram
    const everyone =
      effective.length > 0 && effective.every((s) => !!s.signed_at);
    if (everyone) {
      patch.status = "signed";
      // Maior signed_at = último a assinar
      const last = effective
        .map((s) => s.signed_at)
        .filter((x): x is string => !!x)
        .sort()
        .pop();
      patch.signed_at = last ?? new Date().toISOString();
      patch.last_error = null;
    }
  }

  return patch;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
