import { createFileRoute } from "@tanstack/react-router";
import {
  verifyWebhookSignature,
  changeSubscriptionPlan,
  ensureFullProduct,
  ABACATEPAY_FULL_PRODUCT_PRICE_CENTS,
} from "@/lib/abacatepay.server";

// AbacatePay webhook (apiVersion 2). Configurar a URL no dashboard:
//   <origin>/api/public/abacate-webhook?webhookSecret=<ABACATEPAY_WEBHOOK_SECRET>
// O secret na query string + HMAC do body são validados antes de processar.
export const Route = createFileRoute("/api/public/abacate-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const querySecret = url.searchParams.get("webhookSecret");
        const expectedSecret = process.env.ABACATEPAY_WEBHOOK_SECRET;
        if (!expectedSecret || querySecret !== expectedSecret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const rawBody = await request.text();
        const signature = request.headers.get("x-webhook-signature");
        const valid = await verifyWebhookSignature(rawBody, signature);
        if (!valid) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: {
          id?: string;
          event?: string;
          data?: Record<string, unknown>;
        };
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        if (!event.id || !event.event) {
          return new Response("Missing fields", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotência: registra ou aborta se já visto.
        const { error: dupErr } = await supabaseAdmin.from("webhook_events").insert({
          provider: "abacatepay",
          event_id: event.id,
          event_type: event.event,
          payload: event as never,
        });
        if (dupErr && dupErr.code === "23505") {
          return new Response("ok (duplicate)", { status: 200 });
        }

        await processEvent(event, supabaseAdmin);
        return new Response("ok", { status: 200 });
      },
    },
  },
});

type AdminSupabase = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

interface SubscriptionPayload {
  id?: string;
  status?: string;
  amount?: number;
  externalId?: string;
  nextBilling?: string;
  trialEndsAt?: string;
  canceledAt?: string;
}

interface CustomerPayload {
  id?: string;
  externalId?: string;
}

interface EventPayload {
  data?: {
    subscription?: SubscriptionPayload;
    customer?: CustomerPayload | null;
  };
}

async function processEvent(
  event: { event?: string; data?: Record<string, unknown> },
  supabase: AdminSupabase,
) {
  const payload = event as EventPayload;
  const sub = payload.data?.subscription;
  if (!sub) return; // ignora eventos sem subscription (checkout one-off, payouts, etc.)

  const userId = extractUserId(sub.externalId);
  if (!userId) return;

  const updates: Record<string, unknown> = {
    subscription_id: sub.id ?? null,
    provider: "abacatepay",
  };

  switch (event.event) {
    case "subscription.completed":
    case "subscription.renewed": {
      updates.status = "active";
      updates.last_payment_at = new Date().toISOString();
      if (typeof sub.amount === "number") updates.last_amount_cents = sub.amount;
      if (sub.nextBilling) updates.current_period_end = sub.nextBilling;
      else {
        const d = new Date();
        d.setDate(d.getDate() + 31);
        updates.current_period_end = d.toISOString();
      }
      // Aplica decremento + mudança pro preço cheio quando for o caso.
      await handlePromoCycle({ supabase, userId, subscriptionId: sub.id ?? null, updates });
      break;
    }
    case "subscription.trial_started":
      updates.status = "active";
      if (sub.trialEndsAt) updates.current_period_end = sub.trialEndsAt;
      break;
    case "subscription.cancelled":
      updates.status = "canceled";
      updates.cancel_at = sub.canceledAt ?? new Date().toISOString();
      break;
    case "subscription.payment_failed":
    case "subscription.past_due":
      updates.status = "past_due";
      break;
    case "checkout.refunded":
    case "transparent.refunded":
      updates.status = "refunded";
      break;
    default:
      // outros eventos: só registramos no webhook_events
      return;
  }

  await supabase
    .from("subscriptions")
    .upsert({ user_id: userId, ...updates }, { onConflict: "user_id" });
}

// Lê o estado atual da promo, decrementa, e — quando faltar a última cobrança
// promo — agenda /subscriptions/change-plan pro produto cheio (R$149).
// O AbacatePay aplica no próximo ciclo, mesmo cartão, sem re-checkout.
async function handlePromoCycle(args: {
  supabase: AdminSupabase;
  userId: string;
  subscriptionId: string | null;
  updates: Record<string, unknown>;
}) {
  const { supabase, userId, subscriptionId, updates } = args;
  const { data: current } = await supabase
    .from("subscriptions")
    .select("plan,promo_cycles_remaining,plan_change_scheduled_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!current || current.plan !== "promo") return;
  const remaining = current.promo_cycles_remaining;
  if (remaining == null) return;

  const next = Math.max(0, remaining - 1);
  updates.promo_cycles_remaining = next;

  // Quando ainda faltar 1 cobrança promo (= próximo ciclo já será o cheio),
  // agenda a troca de produto. Idempotente via plan_change_scheduled_at.
  if (next === 1 && !current.plan_change_scheduled_at && subscriptionId) {
    try {
      const fullProduct = await ensureFullProduct();
      await changeSubscriptionPlan({
        subscriptionId,
        productId: fullProduct.id,
        quantity: 1,
      });
      updates.plan_change_scheduled_at = new Date().toISOString();
      updates.amount_cents = ABACATEPAY_FULL_PRODUCT_PRICE_CENTS;
    } catch (err) {
      // Log e segue — o cron/admin pode reagendar manualmente se precisar.
      console.error("[abacate-webhook] change-plan falhou", err);
    }
  }

  if (next === 0) {
    updates.plan = "full";
  }
}

function extractUserId(externalId?: string | null): string | null {
  if (!externalId) return null;
  const m = /^user_([0-9a-f-]{36})$/i.exec(externalId);
  return m ? m[1] : null;
}
