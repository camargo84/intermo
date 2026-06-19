import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Conta contratos do mês corrente + lê a quota da assinatura.
export const getMyMonthlyQuota = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: count, error: countErr } = await context.supabase
      .rpc("current_month_contract_count");
    if (countErr) throw new Error(countErr.message);

    const { data: sub } = await context.supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", context.userId)
      .maybeSingle();

    // Não expõe limite ao front: o plano é ilimitado; o teto interno é só anti-abuso.
    return {
      used: Number(count ?? 0),
      hasActiveSubscription: sub?.status === "active",
    };
  });
