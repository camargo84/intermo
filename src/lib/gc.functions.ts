import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// GC manual do próprio usuário. Critério canônico (mesmo do pg_cron `gc_orphan_drafts`):
// status='draft' AND client_id IS NULL AND pdf_path IS NULL AND created_at < now() - 30 dias.
export const garbageCollectMyDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: candidates, error } = await context.supabase
      .from("transactions")
      .select("id")
      .eq("user_id", context.userId)
      .eq("status", "draft")
      .is("client_id", null)
      .is("pdf_path", null)
      .lt("created_at", cutoff);
    if (error) throw new Error(error.message);

    const ids = (candidates ?? []).map((c) => c.id as string);
    if (ids.length === 0) return { deleted: 0 };

    const { error: delErr } = await context.supabase
      .from("transactions")
      .delete()
      .in("id", ids);
    if (delErr) throw new Error(delErr.message);

    return { deleted: ids.length };
  });
