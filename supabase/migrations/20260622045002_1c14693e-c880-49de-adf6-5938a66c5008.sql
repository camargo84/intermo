REVOKE SELECT, UPDATE ON public.signature_tokens FROM anon;
DROP POLICY IF EXISTS "Anon read by token" ON public.signature_tokens;
DROP POLICY IF EXISTS "Anon sign by token" ON public.signature_tokens;