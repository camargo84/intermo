-- 1) Revoke EXECUTE on current_month_transaction_count from anon and public
REVOKE EXECUTE ON FUNCTION public.current_month_transaction_count() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_month_transaction_count() FROM PUBLIC;

-- 2) Add INSERT/UPDATE/DELETE storage policies for contract-pdfs bucket,
--    scoped to the authenticated user's own folder (first path segment).
DROP POLICY IF EXISTS contract_pdfs_owner_insert ON storage.objects;
CREATE POLICY contract_pdfs_owner_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'contract-pdfs'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS contract_pdfs_owner_update ON storage.objects;
CREATE POLICY contract_pdfs_owner_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'contract-pdfs'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'contract-pdfs'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS contract_pdfs_owner_delete ON storage.objects;
CREATE POLICY contract_pdfs_owner_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'contract-pdfs'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 3) Harden signature_tokens against anon Data API access.
--    Public signing flow already runs server-side via service role (api/public/sign.$token),
--    so anon must never reach this table through PostgREST. Revoke any anon/public grants
--    that may have been added, and add a restrictive policy that explicitly denies anon.
REVOKE ALL ON public.signature_tokens FROM anon;
REVOKE ALL ON public.signature_tokens FROM PUBLIC;

DROP POLICY IF EXISTS signature_tokens_deny_anon ON public.signature_tokens;
CREATE POLICY signature_tokens_deny_anon
  ON public.signature_tokens
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);