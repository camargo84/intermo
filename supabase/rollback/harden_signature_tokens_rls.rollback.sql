-- Rollback da correção de segurança. ATENÇÃO: reabilita o acesso anon que
-- causava o vazamento — só use se a correção quebrar algo inesperado e você
-- precisar voltar ao estado anterior enquanto investiga.

GRANT SELECT, UPDATE ON public.signature_tokens TO anon;

CREATE POLICY "Anon read by token"
ON public.signature_tokens FOR SELECT
TO anon
USING (expires_at > now() AND revoked_at IS NULL);

CREATE POLICY "Anon sign by token"
ON public.signature_tokens FOR UPDATE
TO anon
USING (expires_at > now() AND revoked_at IS NULL AND signed_at IS NULL)
WITH CHECK (expires_at > now() AND revoked_at IS NULL);
