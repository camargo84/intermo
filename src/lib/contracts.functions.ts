import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dispatchContractToAutentique } from "@/lib/autentique-dispatch.server";

// `createContract` foi removido — fluxo unificado via `criarContrato` (agent.functions.ts),
// que valida cliente, produtos, valor e forma de pagamento com o mesmo schema do chat.

export const listContracts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("transactions")
      .select(
        "id,title,client_name,client_email,status,autentique_signers,sent_at,signed_at,last_error,created_at,value_cents,supplier_paid_amount_cents,freight_paid_amount_cents",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { contracts: data ?? [] };
  });

export const getContract = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ contractId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: contract, error } = await context.supabase
      .from("transactions")
      .select("*")
      .eq("id", data.contractId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!contract) throw new Error("NOT_FOUND");

    const { data: events, error: evErr } = await context.supabase
      .from("contract_events")
      .select("id,event_type,status,signer_email,message,created_at")
      .eq("contract_id", contract.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (evErr) throw new Error(evErr.message);

    return { contract, events: events ?? [] };
  });

export const sendContractToAutentique = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ contractId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: hasSub } = await context.supabase.rpc("has_active_subscription", {
      _user_id: context.userId,
    });
    if (!hasSub) throw new Error("Sua assinatura não está ativa.");

    const { data: contract, error } = await context.supabase
      .from("transactions")
      .select("*")
      .eq("id", data.contractId)
      .single();
    if (error || !contract) throw new Error("Contrato não encontrado.");
    if (contract.status !== "draft" || contract.autentique_document_id) {
      throw new Error("Este contrato já foi enviado.");
    }
    return await dispatchContractToAutentique(contract, context.supabase);
  });

export const resendContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ contractId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: contract, error } = await context.supabase
      .from("transactions")
      .select("*")
      .eq("id", data.contractId)
      .single();
    if (error || !contract) throw new Error("Contrato não encontrado.");
    if (contract.status !== "error") {
      throw new Error("Só é possível reenviar contratos com erro.");
    }

    // Reseta o contrato para draft e limpa dados do envio anterior
    const { error: resetErr } = await context.supabase
      .from("transactions")
      .update({
        status: "draft",
        autentique_document_id: null,
        autentique_signers: null,
        sent_at: null,
        last_error: null,
      })
      .eq("id", contract.id);
    if (resetErr) throw new Error(resetErr.message);

    await context.supabase.from("contract_events").insert({
      contract_id: contract.id,
      event_type: "resend_requested",
      status: "draft",
      message: "Reenvio solicitado pelo usuário",
    });

    const fresh = { ...contract, status: "draft", autentique_document_id: null };
    return await dispatchContractToAutentique(fresh, context.supabase);
  });

// Apaga uma transação do usuário (apenas rascunhos ou erros — não apaga já enviados/assinados).
export const deleteTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ contractId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: contract, error: fetchErr } = await context.supabase
      .from("transactions")
      .select("id,status,user_id")
      .eq("id", data.contractId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!contract) throw new Error("Transação não encontrada.");
    if (contract.user_id !== context.userId) throw new Error("Acesso negado.");
    if (!["draft", "error"].includes(contract.status)) {
      throw new Error("Só é possível excluir transações em rascunho ou com erro.");
    }
    const { error: delErr } = await context.supabase
      .from("transactions")
      .delete()
      .eq("id", contract.id);
    if (delErr) throw new Error(delErr.message);
    return { ok: true as const };
  });

// Verifica se o perfil do usuário tem os dados essenciais para gerar contrato/PDF.
export const checkProfileReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: p } = await context.supabase
      .from("profiles")
      .select(
        "company_legal_name,company_cnpj,company_address,company_city,company_uf,representative_name,representative_cpf,comarca",
      )
      .eq("id", context.userId)
      .maybeSingle();
    const missing: string[] = [];
    if (!p?.company_legal_name) missing.push("razão social");
    if (!p?.company_cnpj) missing.push("CNPJ");
    if (!p?.company_address) missing.push("endereço");
    if (!p?.company_city || !p?.company_uf) missing.push("cidade/UF");
    if (!p?.representative_name) missing.push("representante legal");
    if (!p?.representative_cpf) missing.push("CPF do representante");
    if (!p?.comarca) missing.push("comarca");
    return { ready: missing.length === 0, missing };
  });

