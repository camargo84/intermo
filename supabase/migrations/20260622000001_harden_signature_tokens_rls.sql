-- Correção de segurança (CRITICAL): remove o acesso direto de `anon` à tabela
-- signature_tokens.
--
-- Causa-raiz: as policies "Anon read by token" / "Anon sign by token" usavam
--   USING (expires_at > now() AND revoked_at IS NULL ...)
-- na crença de que o filtro `WHERE token = ?` enviado pelo cliente escoparia a
-- linha. RLS NÃO funciona assim: a expressão da policy é o único escopo de
-- linha, e o WHERE do cliente roda depois. Resultado: qualquer portador da
-- anon-key (que é pública no bundle do browser) conseguia SELECT/UPDATE em
-- TODOS os tokens de TODOS os tenants — vazando token, signer_email,
-- signer_doc, transaction_id e permitindo adulterar a assinatura de terceiros.
--
-- Por que remover (e não "consertar") o acesso anon: todo o fluxo público de
-- assinatura (rota /api/public/sign/$token) roda via supabaseAdmin
-- (service_role), que faz bypass de RLS e valida tudo server-side (expiração,
-- revogação, já-assinado, posse). Nenhum código cliente-side lê esta tabela com
-- a anon-key. Logo, `anon` não precisa de privilégio algum aqui — menor
-- privilégio manda remover.

REVOKE SELECT, UPDATE ON public.signature_tokens FROM anon;

DROP POLICY IF EXISTS "Anon read by token" ON public.signature_tokens;
DROP POLICY IF EXISTS "Anon sign by token" ON public.signature_tokens;

-- A policy "Tenants manage own signature tokens" (authenticated) e o acesso
-- service_role permanecem intactos — são o que o app realmente usa.
