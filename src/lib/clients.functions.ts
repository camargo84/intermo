import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { onlyDigits, validateCPF, validateCNPJ } from "./validators";

const upsertSchema = z.object({
  name: z.string().min(2).max(160),
  cpf: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  rg: z.string().max(40).optional().nullable(),
  nacionalidade: z.string().max(60).optional().nullable(),
  estado_civil: z.string().max(40).optional().nullable(),
  data_nascimento: z.string().optional().nullable(),
  cep: z.string().max(12).optional().nullable(),
  endereco: z.string().max(240).optional().nullable(),
  complemento: z.string().max(120).optional().nullable(),
  bairro: z.string().max(120).optional().nullable(),
  cidade: z.string().max(120).optional().nullable(),
  uf: z.string().max(2).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  is_pj: z.boolean().optional(),
});

export const searchClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ query: z.string().min(2).max(160) }).parse(i))
  .handler(async ({ data, context }) => {
    const digits = onlyDigits(data.query);
    let q = context.supabase.from("clients").select("*").eq("user_id", context.userId).limit(10);
    if (digits.length >= 11) {
      q = q.or(`cpf.eq.${digits},cnpj.eq.${digits}`);
    } else {
      q = q.ilike("name", `%${data.query}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { clients: rows ?? [] };
  });

export const upsertClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => upsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const cpf = data.cpf ? onlyDigits(data.cpf) : null;
    const cnpj = data.cnpj ? onlyDigits(data.cnpj) : null;
    if (!cpf && !cnpj) throw new Error("Informe CPF ou CNPJ.");
    if (cpf && !validateCPF(cpf)) throw new Error("CPF inválido.");
    if (cnpj && !validateCNPJ(cnpj)) throw new Error("CNPJ inválido.");

    // procura existente pelo doc
    let existingId: string | null = null;
    if (cpf) {
      const { data: r } = await context.supabase
        .from("clients").select("id").eq("user_id", context.userId).eq("cpf", cpf).maybeSingle();
      if (r) existingId = r.id;
    }
    if (!existingId && cnpj) {
      const { data: r } = await context.supabase
        .from("clients").select("id").eq("user_id", context.userId).eq("cnpj", cnpj).maybeSingle();
      if (r) existingId = r.id;
    }

    const payload = {
      user_id: context.userId,
      name: data.name,
      cpf,
      cnpj,
      rg: data.rg ?? null,
      nacionalidade: data.nacionalidade ?? null,
      estado_civil: data.estado_civil ?? null,
      data_nascimento: data.data_nascimento ?? null,
      cep: data.cep ? onlyDigits(data.cep) : null,
      endereco: data.endereco ?? null,
      complemento: data.complemento ?? null,
      bairro: data.bairro ?? null,
      cidade: data.cidade ?? null,
      uf: data.uf ? data.uf.toUpperCase().slice(0, 2) : null,
      email: data.email ?? null,
      phone: data.phone ? onlyDigits(data.phone) : null,
      is_pj: data.is_pj ?? Boolean(cnpj && !cpf),
    };

    if (existingId) {
      const { error } = await context.supabase.from("clients").update(payload).eq("id", existingId);
      if (error) throw new Error(error.message);
      return { id: existingId, created: false };
    }
    const { data: ins, error } = await context.supabase
      .from("clients").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string, created: true };
  });

export const listMyClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("clients").select("id,name,cpf,cnpj,email,phone,cidade,uf,created_at")
      .order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return { clients: data ?? [] };
  });
