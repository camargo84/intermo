// Helpers de servidor pro AbacatePay (api v2). Não importar do client.

const API_BASE = "https://api.abacatepay.com/v2";

// Chave pública oficial usada pra validar a assinatura HMAC dos webhooks.
// Fonte: https://docs.abacatepay.com/pages/webhooks (Verificação HMAC).
export const ABACATEPAY_PUBLIC_HMAC_KEY =
  "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";

// Dois produtos: promo (6 primeiros meses, 20% off) e full (preço cheio).
// A migração de promo→full no 6º ciclo é feita via /subscriptions/change-plan,
// no mesmo cartão, sem re-checkout do cliente.
export const ABACATEPAY_PROMO_PRODUCT_EXTERNAL_ID = "intermo-mensal-promo-v1";
export const ABACATEPAY_PROMO_PRODUCT_NAME = "inTermo — Boas-vindas (6 primeiros meses)";
export const ABACATEPAY_PROMO_PRODUCT_PRICE_CENTS = 11900;

export const ABACATEPAY_FULL_PRODUCT_EXTERNAL_ID = "intermo-mensal-v1";
export const ABACATEPAY_FULL_PRODUCT_NAME = "inTermo — Assinatura mensal";
export const ABACATEPAY_FULL_PRODUCT_PRICE_CENTS = 14900;

export const PROMO_CYCLES = 6;

// Compat retroativo — código antigo que importava esse símbolo continua funcionando.
export const ABACATEPAY_PRODUCT_PRICE_CENTS = ABACATEPAY_PROMO_PRODUCT_PRICE_CENTS;

type AbacateResponse<T> = { data: T | null; success?: boolean; error?: string | null };

async function abacateFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const apiKey = process.env.ABACATEPAY_API_KEY;
  if (!apiKey) throw new Error("ABACATEPAY_API_KEY não configurado.");
  const { json, headers, ...rest } = init;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : (rest.body as BodyInit | undefined),
  });
  const text = await res.text();
  let parsed: AbacateResponse<T>;
  try {
    parsed = text ? JSON.parse(text) : ({} as AbacateResponse<T>);
  } catch {
    throw new Error(`AbacatePay: resposta inválida (HTTP ${res.status}) — ${text.slice(0, 200)}`);
  }
  if (!res.ok || parsed.success === false || parsed.error) {
    throw new Error(`AbacatePay (${res.status}): ${parsed.error ?? text.slice(0, 200)}`);
  }
  return parsed.data as T;
}

export interface AbacateCustomer {
  id: string;
  email?: string;
  name?: string;
}

export async function ensureCustomer(input: {
  email: string;
  name?: string | null;
  taxId?: string | null;
  cellphone?: string | null;
}): Promise<AbacateCustomer> {
  return abacateFetch<AbacateCustomer>("/customers/create", {
    method: "POST",
    json: {
      data: {
        email: input.email,
        name: input.name ?? undefined,
        taxId: input.taxId ?? undefined,
        cellphone: input.cellphone ?? undefined,
      },
    },
  });
}

interface AbacateProduct {
  id: string;
  externalId?: string;
  name: string;
  price: number;
  cycle?: string | null;
}

async function ensureProduct(opts: {
  externalId: string;
  name: string;
  price: number;
  description: string;
}): Promise<AbacateProduct> {
  try {
    const list = await abacateFetch<{ products?: AbacateProduct[] } | AbacateProduct[]>(
      "/products/list?limit=100",
      { method: "GET" },
    );
    const items = Array.isArray(list) ? list : (list?.products ?? []);
    const existing = items.find((p) => p.externalId === opts.externalId);
    if (existing) return existing;
  } catch {
    // se a listagem falhar, segue pra criar
  }
  return abacateFetch<AbacateProduct>("/products/create", {
    method: "POST",
    json: {
      externalId: opts.externalId,
      name: opts.name,
      price: opts.price,
      currency: "BRL",
      cycle: "MONTHLY",
      description: opts.description,
    },
  });
}

export function ensurePromoProduct(): Promise<AbacateProduct> {
  return ensureProduct({
    externalId: ABACATEPAY_PROMO_PRODUCT_EXTERNAL_ID,
    name: ABACATEPAY_PROMO_PRODUCT_NAME,
    price: ABACATEPAY_PROMO_PRODUCT_PRICE_CENTS,
    description:
      "Acesso completo à plataforma inTermo nos 6 primeiros meses (oferta de boas-vindas, 20% off).",
  });
}

export function ensureFullProduct(): Promise<AbacateProduct> {
  return ensureProduct({
    externalId: ABACATEPAY_FULL_PRODUCT_EXTERNAL_ID,
    name: ABACATEPAY_FULL_PRODUCT_NAME,
    price: ABACATEPAY_FULL_PRODUCT_PRICE_CENTS,
    description: "Acesso completo à plataforma inTermo (renovação mensal, preço cheio).",
  });
}

// Mantido pra compatibilidade — equivale ao produto promo.
export function ensureSubscriptionProduct(): Promise<AbacateProduct> {
  return ensurePromoProduct();
}

export interface AbacateSubscriptionCheckout {
  id: string;
  url: string;
  status?: string;
}

export async function createSubscriptionCheckout(input: {
  productId: string;
  customerId: string;
  externalId: string;
  completionUrl: string;
  returnUrl: string;
}): Promise<AbacateSubscriptionCheckout> {
  return abacateFetch<AbacateSubscriptionCheckout>("/subscriptions/create", {
    method: "POST",
    json: {
      items: [{ id: input.productId, quantity: 1 }],
      customerId: input.customerId,
      externalId: input.externalId,
      completionUrl: input.completionUrl,
      returnUrl: input.returnUrl,
      methods: ["CARD", "PIX"],
    },
  });
}

export async function cancelAbacateSubscription(subscriptionId: string): Promise<void> {
  await abacateFetch<unknown>("/subscriptions/cancel", {
    method: "POST",
    json: { id: subscriptionId },
  });
}

// Troca o produto da assinatura ativa. A mudança fica PENDING e é aplicada
// automaticamente no início do próximo ciclo, no mesmo cartão.
// Doc: https://docs.abacatepay.com/pages/subscriptions/change-plan
export async function changeSubscriptionPlan(input: {
  subscriptionId: string;
  productId: string;
  quantity?: number;
}): Promise<void> {
  await abacateFetch<unknown>("/subscriptions/change-plan", {
    method: "POST",
    json: {
      id: input.subscriptionId,
      productId: input.productId,
      quantity: input.quantity ?? 1,
    },
  });
}

// Valida a assinatura HMAC do header X-Webhook-Signature contra o corpo cru.
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = createHmac("sha256", ABACATEPAY_PUBLIC_HMAC_KEY)
    .update(Buffer.from(rawBody, "utf8"))
    .digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
