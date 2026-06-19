import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

const updateSchema = z.object({
  ownerName: z.string().min(2).max(160),
  companyFantasyName: z.string().min(2).max(160),
  companyLegalName: z.string().min(2).max(200),
  companyEmail: z.string().email().max(200),
  companyPhone: z.string().min(8).max(40),
  defaultMarginPct: z.number().min(0).max(99).optional(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const payload: Record<string, unknown> = {
      owner_name: data.ownerName,
      company_fantasy_name: data.companyFantasyName,
      company_legal_name: data.companyLegalName,
      company_email: data.companyEmail,
      company_phone: data.companyPhone.replace(/\D/g, ""),
    };
    if (data.defaultMarginPct !== undefined) payload.default_margin_pct = data.defaultMarginPct;

    const { error } = await context.supabase
      .from("profiles")
      .update(payload)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
