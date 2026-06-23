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
        "id,pdf_path,signed_pdf_path,status,title,client_id,client_name,client_email,value_cents,client_paid_at,supplier_paid_at,freight_paid_at,consolidated,consolidated_at,forma_pagamento,produtos",
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

export const listMyChatThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(100).default(30),
        cursor: z.string().datetime().nullable().optional(),
      })
      .partial()
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const limit = data.limit ?? 30;
    let q = context.supabase
      .from("chat_threads")
      .select(
        "contract_id,updated_at,transactions!inner(id,title,client_name,status,produtos,created_at,consolidated)",
      )
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (data.cursor) q = q.lt("updated_at", data.cursor);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const threads = rows ?? [];
    const nextCursor =
      threads.length === limit ? (threads[threads.length - 1]?.updated_at as string) : null;
    return { threads, nextCursor };
  });

/**
 * Busca server-side em todas as conversas do usuário. Cobre:
 *  - transactions.client_name
 *  - transactions.title
 *  - chat_threads.messages (json -> texto)
 *
 * Use debounce no cliente. Resultado já vem ordenado por updated_at desc.
 */
export const searchMyChatThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ q: z.string().min(1).max(200), limit: z.number().int().min(1).max(50).default(20) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const term = data.q.trim();
    if (!term) return { results: [] as unknown[] };
    const limit = data.limit ?? 20;
    const escaped = term.replace(/[%_]/g, (m) => `\\${m}`);
    const like = `%${escaped}%`;

    // 1) match no metadado da transação (rápido, usa trigram)
    const metaQ = context.supabase
      .from("chat_threads")
      .select(
        "contract_id,updated_at,transactions!inner(id,title,client_name,status,produtos,created_at,consolidated)",
      )
      .eq("user_id", context.userId)
      .or(`client_name.ilike.${like},title.ilike.${like}`, {
        foreignTable: "transactions",
      })
      .order("updated_at", { ascending: false })
      .limit(limit);

    // 2) match no conteúdo da conversa (GIN tsvector + fallback ilike)
    const bodyQ = context.supabase
      .from("chat_threads")
      .select(
        "contract_id,updated_at,transactions!inner(id,title,client_name,status,produtos,created_at,consolidated)",
      )
      .eq("user_id", context.userId)
      .filter("messages::text", "ilike", like)
      .order("updated_at", { ascending: false })
      .limit(limit);

    const [meta, body] = await Promise.all([metaQ, bodyQ]);
    if (meta.error) throw new Error(meta.error.message);
    if (body.error) throw new Error(body.error.message);

    const seen = new Set<string>();
    const merged: unknown[] = [];
    for (const row of [...(meta.data ?? []), ...(body.data ?? [])]) {
      const id = (row as { contract_id: string }).contract_id;
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(row);
      if (merged.length >= limit) break;
    }
    return { results: merged };
  });
