# Plano — Finalização para Produção

Com base nas suas respostas:
1. **Domínio próprio:** depois. Publicamos em `.lovable.app` agora.
2. **Google Login:** ativar agora.
3. **Admin:** `tiago84@gmail.com`.

---

## 1. Acesso Admin (tiago84@gmail.com)

- Migration idempotente que insere em `public.user_roles` a role `admin` para o `user_id` correspondente ao e-mail `tiago84@gmail.com` em `auth.users`.
- Se o usuário ainda não existir no Auth, a migration apenas não insere nada (sem erro) — basta repetir após o primeiro login.
- Após login, o menu "Admin" aparece automaticamente na Topbar e libera `/contratos-falha` e `/assinaturas`.

## 2. Login com Google

- Rodar `supabase--configure_social_auth` com `providers: ["google"]` (mantém email habilitado).
- Atualizar `src/routes/login.tsx` e `src/routes/signup.tsx` para incluir botão "Continuar com Google" usando `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })` (broker gerenciado).
- Garantir que o `handle_new_user` trigger crie profile mesmo sem metadados (já é tolerante — apenas confirmar).
- Pós-OAuth: redirect para `/dashboard` ou `/assinatura` conforme `has_active_subscription`.

## 3. E-mails Transacionais (publicar em `.lovable.app` primeiro)

- Rodar `email_domain--check_email_domain_status`. Se não existir, abrir diálogo `presentation-open-email-setup` para configurar domínio padrão Lovable (`*.lovable.app` sender) — sem custo de DNS agora.
- Scaffold dos templates de auth (`email_domain--scaffold_auth_email_templates`) com branding minimal (cabeçalho INTERMO, fundo claro, monospace para identificadores).
- Scaffold de 3 templates transacionais:
  - `payment-failed` — disparado pelo webhook AbacatePay (`subscription.payment_failed`).
  - `contract-sent` — disparado após `sendContractToAutentique` com sucesso.
  - `contract-signed` — disparado pelo webhook Autentique em `document.signed`.
- Edge functions de envio (`send-payment-failed`, `send-contract-sent`, `send-contract-signed`) chamadas a partir dos respectivos handlers existentes via `supabase.functions.invoke` (server-side) com retry simples; falhas só logam (não bloqueiam o fluxo principal).
- Deploy de `auth-email-hook` + funções transacionais.
- Quando o usuário trouxer o domínio próprio: basta configurar em "Cloud → Emails", sem mudança de código.

## 4. Smoke Test (Playwright headless local)

Roteiro automatizado para validar antes de publicar:
1. signup novo → redirect `/assinatura`.
2. mock do webhook AbacatePay (`subscription.completed`) → conta vira ativa.
3. criar contrato → enviar para Autentique (mock token) → status `sent`.
4. simular webhook Autentique `document.signed` (HMAC válido) → status `signed` e receita aparece em `/financeiro`.
5. revogar HMAC → webhook responde 401.

Falhas paralisam o go-live.

## 5. Hardening Final e Publicação

- Rodar `security--run_security_scan` — corrigir críticos antes do publish.
- Atualizar metadados raiz (`__root.tsx` head): título, descrição, OG/Twitter, favicon coerentes com INTERMO.
- `preview_ui--publish` com `website_info_status: added_or_updated` e summary descrevendo título/meta/OG/favicon revisados.
- Após publish, instruir você a:
  - Configurar webhook AbacatePay para a URL definitiva `https://intermo.lovable.app/api/public/abacate-webhook?webhookSecret=...`.
  - Confirmar webhook Autentique para `/api/public/autentique-webhook`.

---

## Detalhes técnicos

- **Migration admin:** `insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where email = 'tiago84@gmail.com' on conflict (user_id, role) do nothing;`
- **Google OAuth:** broker gerenciado pelo Lovable Cloud — sem credenciais próprias. Custom domain depois funciona transparente.
- **E-mail sender inicial:** subdomínio `.lovable.app` gerenciado (sem DNS). Migração futura para `notify.intermo.com.br` será só configuração no painel "Cloud → Emails".
- **Sem mudanças** em `auth-middleware.ts`, `client.ts`, `client.server.ts`, `auth-attacher.ts`, `types.ts`, `.env`, `config.toml`.

## Fora de escopo (mantido)
NFS-e, refunds manuais, domínio próprio, Sentry externo.
