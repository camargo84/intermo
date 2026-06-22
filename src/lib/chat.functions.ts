import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Cria um contrato "draft" mínimo e retorna o id (para abrir uma thread nova de chat)
export const createDraftContractForChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: c, error } = await context.supabase
      .from("transactions")
      .insert({
        user_id: context.userId,
        title: "Novo contrato (rascunho)",
        content: "",
        client_name: "—",
        client_email: "",
        status: "draft",
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: tErr } = await context.supabase
      .from("chat_threads")
      .insert({ contract_id: c.id, user_id: context.userId, messages: [] } as never);
    if (tErr) throw new Error(tErr.message);

    return { contractId: c.id as string };
  });

export const getChatThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ contractId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: contract } = await context.supabase
      .from("transactions")
      .select(
        "id,pdf_path,signed_pdf_path,status,title,client_id,client_name,client_email,value_cents,client_paid_at,supplier_paid_at,freight_paid_at,consolidated,consolidated_at",
      )
      .eq("id", data.contractId)
      .maybeSingle();
    if (!contract) throw new Error("Contrato não encontrado.");

    let clientPhone: string | null = null;
    if (contract.client_id) {
      const { data: cli } = await context.supabase
        .from("clients")
        .select("phone")
        .eq("id", contract.client_id)
        .maybeSingle();
      clientPhone = (cli?.phone as string | null) ?? null;
    }

    const { data: thread } = await context.supabase
      .from("chat_threads")
      .select("messages")
      .eq("contract_id", data.contractId)
      .maybeSingle();

    return {
      messagesJson: JSON.stringify((thread?.messages as unknown) ?? []),
      contract: { ...contract, client_phone: clientPhone },
    };
  });

export const consolidateTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ contractId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("transactions")
      .update({
        consolidated: true,
        consolidated_at: new Date().toISOString(),
      } as never)
      .eq("id", data.contractId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveChatThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        contractId: z.string().uuid(),
        messages: z.array(z.unknown()),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    // upsert
    const { data: existing } = await context.supabase
      .from("chat_threads")
      .select("id")
      .eq("contract_id", data.contractId)
      .maybeSingle();
    if (existing) {
      const { error } = await context.supabase
        .from("chat_threads")
        .update({ messages: data.messages as never })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("chat_threads").insert({
        contract_id: data.contractId,
        user_id: context.userId,
        messages: data.messages as never,
      } as never);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const listMyChatThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("chat_threads")
      .select("contract_id,updated_at,transactions!inner(id,title,client_name,status)")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { threads: data ?? [] };
  });
