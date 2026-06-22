import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Remove rascunhos órfãos do usuário atual:
// status=draft, sem PDF gerado, sem cliente real (— ou vazio) e com mais de
// 30 dias desde a última atualização.
export const garbageCollectMyDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: candidates, error } = await context.supabase
      .from("transactions")
      .select("id,client_name,pdf_path,updated_at")
      .eq("user_id", context.userId)
      .eq("status", "draft")
      .is("pdf_path", null)
      .lt("updated_at", cutoff);
    if (error) throw new Error(error.message);

    const ids = (candidates ?? [])
      .filter(
        (c) =>
          !c.client_name ||
          c.client_name.trim() === "" ||
          c.client_name.trim() === "—" ||
          c.client_name.trim() === "-",
      )
      .map((c) => c.id as string);

    if (ids.length === 0) return { deleted: 0 };

    const { error: delErr } = await context.supabase
      .from("transactions")
      .delete()
      .in("id", ids);
    if (delErr) throw new Error(delErr.message);

    return { deleted: ids.length };
  });
