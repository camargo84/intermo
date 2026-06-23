import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { onlyDigits, validateCNPJ, validateCPF } from "./validators";
import { profileMissingFields } from "./contract-requirements";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { profile: data };
  });

// Usada pelo gate de onboarding e por preflights.
// Retorna apenas o status — não vaza dados sensíveis além do que o usuário já tem.
export const getProfileCompleteness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select(
        "company_legal_name,company_cnpj,company_address,company_city,company_uf,representative_name,comarca",
      )
      .eq("id", context.userId)
      .maybeSingle();
    const missing = profileMissingFields(data);
    return { complete: missing.length === 0, missing };
  });

const updateSchema = z.object({
  ownerName: z.string().min(2).max(160),
  companyFantasyName: z.string().min(2).max(160),
  companyLegalName: z.string().min(2).max(200),
  companyEmail: z.string().email().max(200),
  companyPhone: z.string().min(8).max(40),
  companyCnpj: z.string().max(20).optional().nullable(),
  defaultMarginPct: z.number().min(0).max(99).optional(),
  // novos
  companyAddress: z.string().max(240).optional().nullable(),
  companyCity: z.string().max(120).optional().nullable(),
  companyUf: z.string().max(2).optional().nullable(),
  companyCep: z.string().max(12).optional().nullable(),
  representativeName: z.string().max(160).optional().nullable(),
  representativeCpf: z.string().max(20).optional().nullable(),
  representativeQualification: z.string().max(200).optional().nullable(),
  comarca: z.string().max(120).optional().nullable(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const repCpf = data.representativeCpf ? onlyDigits(data.representativeCpf) : null;
    if (repCpf && !validateCPF(repCpf)) throw new Error("CPF do representante inválido.");

    // CNPJ pode ser alterado. Contratos/transações já gerados preservam os dados
    // através do tenant_snapshot salvo no momento da geração, então mudar o CNPJ
    // do perfil não afeta documentos antigos — só passa a valer para novos contratos.
    let cnpjPatch: { company_cnpj: string } | Record<string, never> = {};
    const newCnpjDigits = data.companyCnpj ? onlyDigits(data.companyCnpj) : "";
    if (newCnpjDigits) {
      if (!validateCNPJ(newCnpjDigits)) throw new Error("CNPJ inválido.");
      cnpjPatch = { company_cnpj: newCnpjDigits };
    }

    const payload = {
      owner_name: data.ownerName,
      company_fantasy_name: data.companyFantasyName,
      company_legal_name: data.companyLegalName,
      company_email: data.companyEmail,
      company_phone: data.companyPhone.replace(/\D/g, ""),
      company_address: data.companyAddress ?? null,
      company_city: data.companyCity ?? null,
      company_uf: data.companyUf ? data.companyUf.toUpperCase().slice(0, 2) : null,
      company_cep: data.companyCep ? onlyDigits(data.companyCep) : null,
      representative_name: data.representativeName ?? null,
      representative_cpf: repCpf,
      representative_qualification: data.representativeQualification ?? null,
      comarca: data.comarca ?? null,
      ...(data.defaultMarginPct !== undefined ? { default_margin_pct: data.defaultMarginPct } : {}),
      ...cnpjPatch,
    };

    const { error } = await context.supabase
      .from("profiles")
      .update(payload)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const uploadLogoSchema = z.object({
  base64: z.string().min(10),
  mime: z.enum(["image/png", "image/jpeg"]),
});

export const uploadMyLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => uploadLogoSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 2_000_000) throw new Error("Imagem acima de 2MB.");
    const ext = data.mime === "image/png" ? "png" : "jpg";
    const path = `${context.userId}/logo.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("tenant-logos")
      .upload(path, bytes, { upsert: true, contentType: data.mime });
    if (upErr) throw new Error(upErr.message);
    const { error: updErr } = await context.supabase
      .from("profiles")
      .update({ logo_path: path })
      .eq("id", context.userId);
    if (updErr) throw new Error(updErr.message);
    return { path };
  });

export const getMyLogoSignedUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("logo_path")
      .eq("id", context.userId)
      .maybeSingle();
    if (!prof?.logo_path) return { url: null as string | null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.storage
      .from("tenant-logos")
      .createSignedUrl(prof.logo_path, 600);
    if (error) return { url: null };
    return { url: data.signedUrl };
  });

// Etapa 4b: recria a pasta do tenant na Autentique. Caso raro — o lojista
// renomeou a empresa ou quer uma pasta nova. Zera o folder_id atual e deixa
// ensureTenantFolder criar uma pasta limpa com o nome corrente do perfil.
export const reorganizeAutentiqueFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ensureTenantFolder } = await import("./autentique.server");
    // Limpa o id antigo para forçar a criação de uma nova pasta.
    await context.supabase
      .from("profiles")
      .update({ autentique_folder_id: null })
      .eq("id", context.userId);
    const folderId = await ensureTenantFolder(context.userId, context.supabase);
    if (!folderId) {
      throw new Error(
        "Não foi possível criar a pasta na Autentique. Verifique se a integração está configurada e tente novamente.",
      );
    }
    return { folderId };
  });

// usado pelo agente / debug: valida CNPJ
export const validateCnpjFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ cnpj: z.string() }).parse(i))
  .handler(async ({ data }) => ({ valid: validateCNPJ(data.cnpj) }));
