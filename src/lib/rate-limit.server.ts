// Limita ações por usuário em uma janela de tempo. Usa a tabela rate_limits
// (somente service_role). Se houver erro ao registrar, falha aberta — não bloqueia.

interface CheckArgs {
  userId: string;
  action: string;
  // Janela em segundos
  windowSeconds: number;
  // Máximo de ações dentro da janela
  max: number;
}

export async function checkRateLimit(args: CheckArgs): Promise<{ ok: boolean; retryAfterSec?: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sinceIso = new Date(Date.now() - args.windowSeconds * 1000).toISOString();

  const { count, error } = await supabaseAdmin
    .from("rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", args.userId)
    .eq("action", args.action)
    .gte("created_at", sinceIso);

  if (error) return { ok: true };
  if ((count ?? 0) >= args.max) {
    return { ok: false, retryAfterSec: args.windowSeconds };
  }

  await supabaseAdmin
    .from("rate_limits")
    .insert({ user_id: args.userId, action: args.action });

  return { ok: true };
}
