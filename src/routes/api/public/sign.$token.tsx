import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";

// Rota PÚBLICA (fora de _authenticated): o signatário (cliente OU lojista)
// assina sem login. GET retorna dados do contrato + marca whitelabel do tenant;
// POST captura a assinatura, e quando TODAS as partes tiverem assinado,
// fecha o contrato e dispara a custódia na Autentique (best-effort).

export const Route = createFileRoute("/api/public/sign/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = (params.token ?? "").trim();
        if (!token) return json({ error: "token ausente" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: tk, error } = await supabaseAdmin
          .from("signature_tokens")
          .select(
            "id, token, transaction_id, signer_role, signer_name, signed_at, revoked_at, expires_at",
          )
          .eq("token", token)
          .maybeSingle();
        if (error) return json({ error: "internal" }, 500);
        if (!tk) return json({ error: "Token inválido." }, 404);

        if (tk.revoked_at) return json({ error: "Link revogado." }, 410);
        if (new Date(tk.expires_at).getTime() < Date.now()) {
          return json({ error: "Link expirado." }, 410);
        }
        if (tk.signed_at) {
          return json({ alreadySigned: true, signedAt: tk.signed_at });
        }

        const { data: tx } = await supabaseAdmin
          .from("transactions")
          .select("id, user_id, title, client_name, value_cents, pdf_path")
          .eq("id", tk.transaction_id)
          .maybeSingle();
        if (!tx) return json({ error: "Contrato não encontrado." }, 404);

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select(
            "company_legal_name, company_fantasy_name, owner_name, logo_path",
          )
          .eq("id", tx.user_id)
          .maybeSingle();

        let pdfUrl: string | null = null;
        if (tx.pdf_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("contract-pdfs")
            .createSignedUrl(tx.pdf_path, 600);
          pdfUrl = signed?.signedUrl ?? null;
        }

        let tenantLogoUrl: string | null = null;
        if (profile?.logo_path) {
          const { data: signedLogo } = await supabaseAdmin.storage
            .from("tenant-logos")
            .createSignedUrl(profile.logo_path, 3600);
          tenantLogoUrl = signedLogo?.signedUrl ?? null;
        }

        const tenantName =
          profile?.company_fantasy_name ||
          profile?.company_legal_name ||
          profile?.owner_name ||
          null;

        return json({
          lojista:
            profile?.company_legal_name ||
            profile?.company_fantasy_name ||
            profile?.owner_name ||
            "Loja",
          tenantName,
          tenantLogoUrl,
          cliente: tx.client_name,
          signerName: tk.signer_name ?? tx.client_name,
          signerRole: tk.signer_role,
          produto: tx.title,
          valorCents: tx.value_cents ?? null,
          pdfUrl,
        });
      },

      POST: async ({ request, params }) => {
        const token = (params.token ?? "").trim();
        if (!token) return json({ error: "token ausente" }, 400);

        let body: {
          signer_name?: string;
          signature_image?: string;
          consent?: boolean;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "json inválido" }, 400);
        }

        if (body.consent !== true) {
          return json({ error: "Consentimento obrigatório." }, 400);
        }
        const signerName = (body.signer_name ?? "").trim();
        if (signerName.length < 2) {
          return json({ error: "Informe seu nome completo." }, 400);
        }
        const dataUrl = body.signature_image ?? "";
        const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
        if (!m) {
          return json({ error: "Assinatura inválida." }, 400);
        }
        const pngBytes = Buffer.from(m[1], "base64");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: tk } = await supabaseAdmin
          .from("signature_tokens")
          .select("id, transaction_id, signer_role, signed_at, revoked_at, expires_at")
          .eq("token", token)
          .maybeSingle();
        if (!tk) return json({ error: "Token inválido." }, 404);
        if (tk.revoked_at) return json({ error: "Link revogado." }, 410);
        if (new Date(tk.expires_at).getTime() < Date.now()) {
          return json({ error: "Link expirado." }, 410);
        }
        if (tk.signed_at) {
          return json({ ok: true, alreadySigned: true });
        }

        const { data: tx } = await supabaseAdmin
          .from("transactions")
          .select("id, pdf_path")
          .eq("id", tk.transaction_id)
          .maybeSingle();
        if (!tx) return json({ error: "Contrato não encontrado." }, 404);

        // Hash do PDF original para vincular a assinatura ao documento exato.
        let pdfHash: string | null = null;
        if (tx.pdf_path) {
          try {
            const { data: blob } = await supabaseAdmin.storage
              .from("contract-pdfs")
              .download(tx.pdf_path);
            if (blob) {
              const bytes = new Uint8Array(await blob.arrayBuffer());
              pdfHash = createHash("sha256").update(bytes).digest("hex");
            }
          } catch {
            // hash é complementar; não bloqueia a assinatura
          }
        }

        const imagePath = `signatures/${tx.id}/${token}.png`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("contract-pdfs")
          .upload(imagePath, pngBytes, { upsert: true, contentType: "image/png" });
        if (upErr) return json({ error: "Falha ao salvar assinatura." }, 500);

        const ip =
          (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
          request.headers.get("x-real-ip") ||
          null;
        const userAgent = request.headers.get("user-agent");

        const { error: updErr } = await supabaseAdmin
          .from("signature_tokens")
          .update({
            signed_at: new Date().toISOString(),
            signed_ip: ip,
            signed_user_agent: userAgent,
            signer_name: signerName,
            signature_image_path: imagePath,
            pdf_hash: pdfHash,
          })
          .eq("id", tk.id);
        if (updErr) return json({ error: "Falha ao registrar assinatura." }, 500);

        await supabaseAdmin.from("contract_events").insert({
          contract_id: tx.id,
          event_type: "white_label_signed",
          status: null,
          signer_email: null,
          message: `Assinatura eletrônica capturada (${signerName}, papel: ${tk.signer_role}). IP ${ip ?? "?"}.`,
          payload: null,
        });

        // Verifica se todos os tokens ativos do contrato já foram assinados.
        // Se sim: marca status=signed e dispara custódia na Autentique.
        const { data: allTokens } = await supabaseAdmin
          .from("signature_tokens")
          .select("id, signer_role, signed_at, revoked_at")
          .eq("transaction_id", tx.id);

        const active = (allTokens ?? []).filter((t) => !t.revoked_at);
        const roles = new Set(active.map((t) => t.signer_role));
        const allSigned =
          active.length > 0 &&
          roles.has("cliente") &&
          roles.has("lojista") &&
          active.every((t) => t.signed_at);

        if (allSigned) {
          await supabaseAdmin
            .from("transactions")
            .update({ status: "signed", signed_at: new Date().toISOString() })
            .eq("id", tx.id);

          // Custódia Autentique (best-effort).
          try {
            const { pushContractToCustody } = await import("@/lib/autentique-custody.server");
            const result = await pushContractToCustody(tx.id, supabaseAdmin);
            if (!result.ok) {
              await supabaseAdmin.from("contract_events").insert({
                contract_id: tx.id,
                event_type: "custody_failed",
                status: null,
                message: `Custódia Autentique falhou: ${result.reason}`,
              });
            }
          } catch (e) {
            await supabaseAdmin.from("contract_events").insert({
              contract_id: tx.id,
              event_type: "custody_failed",
              status: null,
              message: `Custódia Autentique exception: ${e instanceof Error ? e.message : String(e)}`,
            });
          }
        }

        return json({ ok: true, allSigned });
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
