-- Função global para garbage-collect de rascunhos órfãos, executável via pg_cron sem sessão.
-- WHERE canônico: status='draft' AND client_id IS NULL AND pdf_path IS NULL AND created_at < now() - 30 dias.
-- _dry_run=true (default) apenas conta; _dry_run=false apaga. Restrita a postgres/service_role.

CREATE OR REPLACE FUNCTION public.gc_orphan_drafts(_dry_run boolean DEFAULT true)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected bigint;
BEGIN
  IF _dry_run THEN
    SELECT count(*) INTO affected
    FROM public.transactions
    WHERE status = 'draft'
      AND client_id IS NULL
      AND pdf_path IS NULL
      AND created_at < (now() - interval '30 days');
    RETURN affected;
  END IF;

  WITH deleted AS (
    DELETE FROM public.transactions
    WHERE status = 'draft'
      AND client_id IS NULL
      AND pdf_path IS NULL
      AND created_at < (now() - interval '30 days')
    RETURNING 1
  )
  SELECT count(*) INTO affected FROM deleted;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.gc_orphan_drafts(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_orphan_drafts(boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gc_orphan_drafts(boolean) TO service_role;

COMMENT ON FUNCTION public.gc_orphan_drafts(boolean) IS
  'GC de rascunhos órfãos. Critério: status=draft AND client_id IS NULL AND pdf_path IS NULL AND created_at < now()-30d. _dry_run=true conta, false apaga. Agendar via pg_cron às 07:00 UTC (= 04:00 BRT).';