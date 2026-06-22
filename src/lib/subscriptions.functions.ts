import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ensureCustomer,
  ensureSubscriptionProduct,
  createSubscriptionCheckout,
  cancelAbacateSubscription,
  ABACATEPAY_PRODUCT_PRICE_CENTS,
} from "@/lib/abacatepay.server";
import { checkRateLimit } from "@/lib/rate-limit.server";

function getOrigin(): string {
  // Em produção e preview, definimos sempre via process.env.VITE_PUBLIC_BASE_URL se houver;
  // como fallback, derivamos do host injetado pela Lovable.
  return (
    process.env.VITE_PUBLIC_BASE_URL ||
    process.env.PUBLIC_BASE_URL ||
    "https://project--e12de342-f34c-49f9-a3b6-1f3e34d13532.lovable.app"
  );
}

export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("subscriptions")
      .select(
        "status,current_period_end,last_payment_at,amount_cents,monthly_contract_quota,provider,cancel_at",
      )
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { subscription: data };
  });

export const createAbacateCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const rate = await checkRateLimit({
      userId: context.userId,
      action: "create_checkout",
      windowSeconds: 60,
      max: 5,
    });
    if (!rate.ok) throw new Error("Muitas tentativas. Aguarde um minuto e tente de novo.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Profile com dados pra pré-preencher o customer
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("owner_name,company_email,company_phone,company_cnpj")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: existing } = await context.supabase
      .from("subscriptions")
      .select("status,customer_id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existing?.status === "active") {
      throw new Error("Você já tem uma assinatura ativa.");
    }

    // Email do auth user
    const userEmail = context.claims?.email as string | undefined;
    if (!userEmail) throw new Error("Conta sem e-mail. Atualize seu cadastro.");

    let customerId = existing?.customer_id ?? null;
    if (!customerId) {
      const customer = await ensureCustomer({
        email: profile?.company_email || userEmail,
        name: profile?.owner_name ?? undefined,
        taxId: profile?.company_cnpj ?? undefined,
        cellphone: profile?.company_phone
          ? `+55${profile.company_phone.replace(/\D/g, "")}`
          : undefined,
      });
      customerId = customer.id;
    }

    const product = await ensureSubscriptionProduct();

    const origin = getOrigin();
    const checkout = await createSubscriptionCheckout({
      productId: product.id,
      customerId: customerId!,
      externalId: `user_${context.userId}`,
      completionUrl: `${origin}/assinatura?status=ok`,
      returnUrl: `${origin}/assinatura?status=cancel`,
    });

    // Persiste pendência da assinatura (não sobrescreve uma ativa)
    await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: context.userId,
        provider: "abacatepay",
        customer_id: customerId!,
        status: "pending",
        amount_cents: ABACATEPAY_PRODUCT_PRICE_CENTS,
        metadata: { last_checkout_id: checkout.id },
      },
      { onConflict: "user_id" },
    );

    return { url: checkout.url };
  });

export const cancelMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub, error } = await context.supabase
      .from("subscriptions")
      .select("subscription_id,status")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sub?.subscription_id) throw new Error("Nenhuma assinatura ativa encontrada.");
    if (sub.status === "canceled") return { ok: true };

    await cancelAbacateSubscription(sub.subscription_id);

    await supabaseAdmin
      .from("subscriptions")
      .update({ status: "canceled", cancel_at: new Date().toISOString() })
      .eq("user_id", context.userId);

    return { ok: true };
  });
