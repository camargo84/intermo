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
        const provided = (params._splat ?? "").trim();
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
            .from("contracts")
            .select("id,status,autentique_signers")
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
              .from("contracts")
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
