// Helpers de servidor pro AbacatePay (api v2). Não importar do client.

const API_BASE = "https://api.abacatepay.com/v2";

// Chave pública oficial usada pra validar a assinatura HMAC dos webhooks.
// Fonte: https://docs.abacatepay.com/pages/webhooks (Verificação HMAC).
export const ABACATEPAY_PUBLIC_HMAC_KEY =
  "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";

export const ABACATEPAY_PRODUCT_EXTERNAL_ID = "intermo-mensal-v1";
export const ABACATEPAY_PRODUCT_NAME = "inTermo — Assinatura mensal";
export const ABACATEPAY_PRODUCT_PRICE_CENTS = 11900;

type AbacateResponse<T> = { data: T | null; success?: boolean; error?: string | null };

async function abacateFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
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

// Garante o produto de assinatura no AbacatePay, idempotente por externalId.
export async function ensureSubscriptionProduct(): Promise<AbacateProduct> {
  // Lista e procura pelo externalId.
  try {
    const list = await abacateFetch<{ products?: AbacateProduct[] } | AbacateProduct[]>(
      "/products/list?limit=100",
      { method: "GET" },
    );
    const items = Array.isArray(list) ? list : (list?.products ?? []);
    const existing = items.find((p) => p.externalId === ABACATEPAY_PRODUCT_EXTERNAL_ID);
    if (existing) return existing;
  } catch {
    // segue pra criar; erro de listagem não deve travar
  }
  return abacateFetch<AbacateProduct>("/products/create", {
    method: "POST",
    json: {
      externalId: ABACATEPAY_PRODUCT_EXTERNAL_ID,
      name: ABACATEPAY_PRODUCT_NAME,
      price: ABACATEPAY_PRODUCT_PRICE_CENTS,
      currency: "BRL",
      cycle: "MONTHLY",
      description: "Acesso completo à plataforma inTermo (renovação mensal).",
    },
  });
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

// Valida a assinatura HMAC do header X-Webhook-Signature contra o corpo cru.
export async function verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = createHmac("sha256", ABACATEPAY_PUBLIC_HMAC_KEY)
    .update(Buffer.from(rawBody, "utf8"))
    .digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
