import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TERMS_VERSION } from "@/lib/terms";

export const getTermsStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("accepted_terms_version,accepted_terms_at")
      .eq("id", context.userId)
      .maybeSingle();
    const accepted = data?.accepted_terms_version ?? null;
    return {
      current: TERMS_VERSION,
      accepted,
      uptodate: accepted === TERMS_VERSION,
      accepted_at: data?.accepted_terms_at ?? null,
    };
  });

export const acceptCurrentTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({
        accepted_terms_version: TERMS_VERSION,
        accepted_terms_at: new Date().toISOString(),
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true, version: TERMS_VERSION };
  });
