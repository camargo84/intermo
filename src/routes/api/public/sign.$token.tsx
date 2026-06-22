import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";

// Rota PÚBLICA (fora de _authenticated): o cliente final assina sem login.
// GET  /api/public/sign/:token  -> dados públicos do contrato + URL do PDF
// POST /api/public/sign/:token  -> captura a assinatura eletrônica white-label
//
// Segurança: o token é uma chave de lookup de alta entropia (32 bytes). Não é
// comparado por timingSafeEqual porque não é um segredo compartilhado fixo —
// é um identificador único por contrato. Toda a validação (expiração, revogação,
// já-assinado) é feita server-side via supabaseAdmin (service role).

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

        // Dados mínimos do contrato + dados do lojista para identidade.
        const { data: tx } = await supabaseAdmin
          .from("transactions")
          .select("id, user_id, title, client_name, value_cents, pdf_path")
          .eq("id", tk.transaction_id)
          .maybeSingle();
        if (!tx) return json({ error: "Contrato não encontrado." }, 404);

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("company_legal_name, company_fantasy_name, owner_name")
          .eq("id", tx.user_id)
          .maybeSingle();

        let pdfUrl: string | null = null;
        if (tx.pdf_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("contract-pdfs")
            .createSignedUrl(tx.pdf_path, 600);
          pdfUrl = signed?.signedUrl ?? null;
        }

        return json({
          lojista:
            profile?.company_legal_name ||
            profile?.company_fantasy_name ||
            profile?.owner_name ||
            "Loja",
          cliente: tx.client_name,
          signerName: tk.signer_name ?? tx.client_name,
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

        // Revalida o token server-side (estado pode ter mudado desde o GET).
        const { data: tk } = await supabaseAdmin
          .from("signature_tokens")
          .select("id, transaction_id, signed_at, revoked_at, expires_at")
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

        // Salva a imagem da assinatura no bucket privado.
        const imagePath = `signatures/${tx.id}/${token}.png`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("contract-pdfs")
          .upload(imagePath, pngBytes, {
            upsert: true,
            contentType: "image/png",
          });
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

        // Registro de auditoria (MP 2.200-2): a assinatura white-label foi
        // capturada com consentimento, IP e user-agent.
        await supabaseAdmin.from("contract_events").insert({
          contract_id: tx.id,
          event_type: "white_label_signed",
          status: null,
          signer_email: null,
          message: `Assinatura eletrônica capturada (${signerName}). IP ${ip ?? "?"}.`,
          payload: null,
        });

        // Replicação Autentique (best-effort, invisível ao cliente).
        // TODO(autentique-schema): a API v2 da Autentique não expõe um endpoint
        // claro para INJETAR uma assinatura já coletada externamente em um
        // documento. As opções reais são: (a) usar a Autentique apenas como
        // custódia, anexando o PDF + evidências via createDocument com a
        // assinatura embutida; ou (b) operar o fluxo de assinatura inteiramente
        // white-label e tratar a Autentique como arquivo morto. Mantemos o
        // registro de auditoria acima como prova primária até a decisão de
        // produto/jurídico. Não inventamos chamada de API aqui.

        return json({ ok: true });
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
