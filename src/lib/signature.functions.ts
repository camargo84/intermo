import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Gera (ou reusa) um token de assinatura whitelabel para um contrato.
 *
 * Para cada papel (`cliente` ou `lojista`), só existe UM token ativo por
 * contrato. Se já houver um não-assinado e não-revogado, devolve esse mesmo;
 * caso contrário cria um novo.
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
    const { data: contract, error } = await context.supabase
      .from("transactions")
      .select("id, user_id, client_name, client_email, client_doc")
      .eq("id", data.contractId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!contract || contract.user_id !== context.userId) {
      throw new Error("Contrato não encontrado.");
    }

    // Reusa token ativo se existir para esse papel.
    const { data: existing } = await context.supabase
      .from("signature_tokens")
      .select("token, signed_at, revoked_at, expires_at")
      .eq("transaction_id", contract.id)
      .eq("signer_role", data.signerRole)
      .maybeSingle();

    if (
      existing &&
      !existing.signed_at &&
      !existing.revoked_at &&
      new Date(existing.expires_at).getTime() > Date.now()
    ) {
      return { token: existing.token, url: `/assinar/${existing.token}` };
    }

    const token = randomBytes(32).toString("base64url");

    let signerName: string | null = null;
    let signerEmail: string | null = null;
    let signerDoc: string | null = null;
    if (data.signerRole === "cliente") {
      signerName = contract.client_name;
      signerEmail = contract.client_email;
      signerDoc = contract.client_doc ?? null;
    } else {
      const { data: profile } = await context.supabase
        .from("profiles")
        .select("representative_name, representative_cpf, company_email, owner_name")
        .eq("id", context.userId)
        .maybeSingle();
      signerName = profile?.representative_name ?? profile?.owner_name ?? null;
      signerEmail = profile?.company_email ?? null;
      signerDoc = profile?.representative_cpf ?? null;
    }

    const { error: insErr } = await context.supabase.from("signature_tokens").insert({
      token,
      transaction_id: contract.id,
      signer_role: data.signerRole,
      signer_name: signerName,
      signer_email: signerEmail,
      signer_doc: signerDoc,
    });
    if (insErr) throw new Error(insErr.message);

    return { token, url: `/assinar/${token}` };
  });

/**
 * Lista os tokens de assinatura de um contrato com status (assinado/pendente).
 * Usado pela tela do contrato para mostrar quem já assinou e gerar links.
 */
export const listSignatureTokens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ contractId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: contract } = await context.supabase
      .from("transactions")
      .select("id, user_id")
      .eq("id", data.contractId)
      .maybeSingle();
    if (!contract || contract.user_id !== context.userId) {
      throw new Error("Contrato não encontrado.");
    }
    const { data: rows } = await context.supabase
      .from("signature_tokens")
      .select(
        "token, signer_role, signer_name, signer_email, signed_at, revoked_at, expires_at, created_at",
      )
      .eq("transaction_id", contract.id)
      .order("created_at", { ascending: true });
    return { tokens: rows ?? [] };
  });
