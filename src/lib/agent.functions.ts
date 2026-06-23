import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { TenantSnapshot, ContractClient, ContractProduto } from "./contracts.pdf.server";

type Supa = SupabaseClient<Database>;

// ============ Tenant snapshot (sem dados pessoais de cliente) ============
async function buildTenantSnapshot(supabase: Supa, userId: string): Promise<TenantSnapshot> {
  const { data: p, error } = await supabase
    .from("profiles")
    .select(
      "company_legal_name,company_fantasy_name,company_cnpj,company_address,company_city,company_uf,company_cep,representative_name,representative_qualification,comarca,logo_path",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!p) throw new Error("Perfil não encontrado.");
  const { profileMissingFields } = await import("./contract-requirements");
  const missing = profileMissingFields(p);
  if (missing.length > 0) {
    throw new Error(`Complete em Configurações: ${missing.join(", ")}.`);
  }
  return {
    company_legal_name: p.company_legal_name,
    company_fantasy_name: p.company_fantasy_name,
    company_cnpj: p.company_cnpj,
    company_address: p.company_address,
    company_city: p.company_city,
    company_uf: p.company_uf,
    company_cep: p.company_cep,
    representative_name: p.representative_name,
    representative_qualification: p.representative_qualification,
    comarca: p.comarca,
  };
}

// ============ criar contrato (chamada pelo agente) ============
const produtoSchema = z.object({
  descricao: z.string().min(2).max(200),
  quantidade: z.number().int().positive().max(99),
  preco_unit_cents: z.number().int().positive(),
});

const criarContratoSchema = z.object({
  client_id: z.string().uuid(),
  produtos: z.array(produtoSchema).min(1),
  valor_cents: z.number().int().positive(),
  forma_pagamento: z.enum(["avista", "parcelado", "misto"]),
  entrada_cents: z.number().int().nonnegative().default(0),
  parcelas: z.number().int().positive().max(36).optional().nullable(),
});

export const criarContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => criarContratoSchema.parse(i))
  .handler(async ({ data, context }) => {
    // Termos vigentes
    const { TERMS_VERSION } = await import("@/lib/terms");
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("accepted_terms_version")
      .eq("id", context.userId)
      .maybeSingle();
    if (profile?.accepted_terms_version !== TERMS_VERSION) {
      throw new Error("Aceite os novos termos para continuar.");
    }

    // Assinatura ativa
    const { data: hasSub } = await context.supabase.rpc("has_active_subscription", {
      _user_id: context.userId,
    });
    if (!hasSub) throw new Error("Sua assinatura não está ativa.");

    // Anti-abuso interno (não exibe limite)
    const { data: count } = await context.supabase.rpc("current_month_transaction_count");
    const { data: sub } = await context.supabase
      .from("subscriptions")
      .select("monthly_contract_quota")
      .eq("user_id", context.userId)
      .maybeSingle();
    const ceil = sub?.monthly_contract_quota ?? 2000;
    if ((count ?? 0) >= ceil) throw new Error("Uso anormal detectado. Tente novamente mais tarde.");

    // Validação misto
    if (data.forma_pagamento === "misto") {
      if (!(data.entrada_cents > 0 && data.entrada_cents < data.valor_cents)) {
        throw new Error("Entrada inválida: deve ser maior que zero e menor que o valor total.");
      }
    }

    // Cliente pertence ao usuário?
    const { data: cli, error: ce } = await context.supabase
      .from("clients")
      .select("id,name,email,cpf,cnpj")
      .eq("id", data.client_id)
      .maybeSingle();
    if (ce) throw new Error(ce.message);
    if (!cli) throw new Error("Cliente não encontrado.");

    const tenant_snapshot = await buildTenantSnapshot(context.supabase, context.userId);

    const title = `Contrato — ${cli.name}`;
    const content = data.produtos.map((p) => `${p.quantidade}x ${p.descricao}`).join("; ");
    const clientDoc = (cli.cpf ?? cli.cnpj ?? null) as string | null;
    const clientEmail = (cli.email ?? "") as string;

    const { data: row, error } = await context.supabase
      .from("transactions")
      .insert({
        user_id: context.userId,
        client_id: data.client_id,
        title,
        content,
        client_name: cli.name,
        client_email: clientEmail,
        client_doc: clientDoc,
        produtos: data.produtos,
        value_cents: data.valor_cents,
        forma_pagamento: data.forma_pagamento,
        entrada_cents: data.entrada_cents,
        tenant_snapshot: tenant_snapshot as unknown as Record<string, unknown>,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, parcelas: data.parcelas ?? null };
  });

// ============ gerar PDF ============
export const gerarPdfContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        contract_id: z.string().uuid(),
        parcelas: z.number().int().positive().optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: contract, error } = await context.supabase
      .from("transactions")
      .select("*")
      .eq("id", data.contract_id)
      .maybeSingle();
    if (error || !contract) throw new Error("Contrato não encontrado.");
    if (!contract.client_id) throw new Error("Contrato sem cliente vinculado.");

    const { data: cliente, error: cliErr } = await context.supabase
      .from("clients")
      .select("*")
      .eq("id", contract.client_id)
      .maybeSingle();
    if (cliErr || !cliente) throw new Error("Cliente não encontrado.");

    const tenant = contract.tenant_snapshot as unknown as TenantSnapshot;
    if (!tenant) throw new Error("Snapshot do tenant ausente.");

    // logo (download privado)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("logo_path")
      .eq("id", context.userId)
      .maybeSingle();
    let logoBytes: Uint8Array | null = null;
    let logoMime: "image/png" | "image/jpeg" | null = null;
    if (prof?.logo_path) {
      const { data: blob } = await supabaseAdmin.storage
        .from("tenant-logos")
        .download(prof.logo_path);
      if (blob) {
        logoBytes = new Uint8Array(await blob.arrayBuffer());
        logoMime =
          prof.logo_path.endsWith(".jpg") || prof.logo_path.endsWith(".jpeg")
            ? "image/jpeg"
            : "image/png";
      }
    }

    const { renderContractPdf } = await import("./contracts.pdf.server");
    const pdfBytes = await renderContractPdf({
      tenant,
      cliente: cliente as ContractClient,
      produtos: (contract.produtos as unknown as ContractProduto[]) ?? [],
      valor_cents: contract.value_cents ?? 0,
      forma_pagamento: (contract.forma_pagamento ?? "avista") as "avista" | "parcelado" | "misto",
      entrada_cents: contract.entrada_cents ?? 0,
      parcelas: data.parcelas ?? null,
      logoBytes,
      logoMime,
    });

    const path = `${context.userId}/${contract.id}.pdf`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("contract-pdfs")
      .upload(path, pdfBytes, { upsert: true, contentType: "application/pdf" });
    if (upErr) throw new Error(upErr.message);

    await context.supabase.from("transactions").update({ pdf_path: path }).eq("id", contract.id);

    const { data: signed } = await supabaseAdmin.storage
      .from("contract-pdfs")
      .createSignedUrl(path, 600);
    return { pdf_path: path, signed_url: signed?.signedUrl ?? null };
  });

// ============ helper para o front baixar PDF ============
export const getContractPdfSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ contract_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: c } = await context.supabase
      .from("transactions")
      .select("pdf_path,user_id")
      .eq("id", data.contract_id)
      .maybeSingle();
    if (!c?.pdf_path) return { url: null as string | null };
    if (c.user_id !== context.userId) return { url: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.storage
      .from("contract-pdfs")
      .createSignedUrl(c.pdf_path, 600);
    return { url: s?.signedUrl ?? null };
  });

// ============ helper para o front baixar PDF assinado (Autentique) ============
export const getSignedContractPdfUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ contract_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: c } = await context.supabase
      .from("transactions")
      .select("signed_pdf_path,user_id")
      .eq("id", data.contract_id)
      .maybeSingle();
    if (!c?.signed_pdf_path) return { url: null as string | null };
    if (c.user_id !== context.userId) return { url: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.storage
      .from("contract-pdfs")
      .createSignedUrl(c.signed_pdf_path, 600);
    return { url: s?.signedUrl ?? null };
  });
