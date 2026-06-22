import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Gera um token de assinatura white-label para um contrato.
 *
 * O token é uma string urlsafe aleatória (não é segredo comparado por tempo —
 * é uma chave de lookup única e de alta entropia). A página pública
 * /assinar/:token usa esse token para exibir o contrato e capturar a assinatura
 * eletrônica do cliente sob o nosso domínio, sem expor a Autentique.
 *
 * Valida que a transação pertence ao usuário autenticado antes de emitir.
 */
export const createSignatureToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        contractId: z.string().uuid(),
        signerRole: z.enum(["lojista", "cliente"]).default("cliente"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // 1) A transação tem que ser do usuário (RLS já protege, mas validamos cedo).
    const { data: contract, error } = await context.supabase
      .from("transactions")
      .select("id, user_id, client_name, client_email, client_doc")
      .eq("id", data.contractId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!contract || contract.user_id !== context.userId) {
      throw new Error("Contrato não encontrado.");
    }

    // 2) Token urlsafe de alta entropia (32 bytes → 43 chars base64url).
    const token = randomBytes(32).toString("base64url");

    // 3) Persiste o token vinculado à transação.
    const { error: insErr } = await context.supabase.from("signature_tokens").insert({
      token,
      transaction_id: contract.id,
      signer_role: data.signerRole,
      signer_name: contract.client_name,
      signer_email: contract.client_email,
      signer_doc: contract.client_doc ?? null,
    });
    if (insErr) throw new Error(insErr.message);

    return { token, url: `/assinar/${token}` };
  });
