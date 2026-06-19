## Sprints 2 e 3 — Confiança, operação e go-live

Sprint 1 (AbacatePay + assinaturas + guards) já está no ar. Falta destravar suporte, e-mails transacionais, polimento e publicação.

---

### Sprint 2 — Confiança e operação

**2.1 Papéis admin (suporte e observabilidade)**
- Migração: enum `app_role` já existe; criar layout `src/routes/_authenticated/_admin/route.tsx` com gate `has_role('admin')` (server fn `getMyRoles`).
- `src/routes/_authenticated/_admin/contratos-falha.tsx`: lista `contracts.status='error'` com `last_error`, botão "reprocessar" (chama `sendContractToAutentique` de novo).
- `src/routes/_authenticated/_admin/assinaturas.tsx`: tabela agregada de `subscriptions` (status, último pagamento, próxima cobrança).
- Sem item no menu lateral pra usuário comum; admin vê link extra na Topbar.

**2.2 E-mails transacionais (Lovable Email)**
- Rodar `email_domain--check_email_domain_status`. Se não houver domínio, abrir o setup dialog antes de seguir.
- `email_domain--scaffold_auth_email_templates` para confirmação de cadastro, reset de senha, magic link.
- `email_domain--scaffold_transactional_email` para:
  - "Pagamento falhou" — disparado pelo webhook AbacatePay (`subscription.payment_failed`).
  - "Contrato enviado para assinatura" — disparado quando `sendContractToAutentique` retorna ok.
  - "Contrato assinado" — disparado pelo webhook Autentique (`signed`).
- Aplicar identidade Sandclock terminal nos templates (cores/tipografia do app, body branco).

**2.3 Hardening final**
- `supabase--configure_social_auth` Google (provider precisa ser ativado pra o botão não dar "Unsupported provider"; HIBP já está on).
- Auditar `src/routes/api/public/autentique-webhook.$.tsx` pra garantir verificação HMAC timing-safe (mesmo padrão do AbacatePay).
- Rodar `security--run_security_scan` e tratar críticos.

---

### Sprint 3 — Polimento e go-live

**3.1 SEO público**
- `head()` por rota pública (`/`, `/login`, `/signup`, `/termos`, `/privacidade`) com `<title>`, description, `og:title/description/type`, `twitter:card`. Sem `og:image` no `__root` (substituiria leaf).
- `public/robots.txt` permitindo tudo, sem `Sitemap:` até publicar.
- Server route `src/routes/api/public/sitemap.xml.ts` gerando sitemap das rotas públicas.

**3.2 LGPD**
- Banner de cookies (aceitar/recusar) persistido em `localStorage`; sem analytics até aceite.
- `accepted_terms_version` já está no `profiles`; criar versão constante `TERMS_VERSION` e, quando `profile.accepted_terms_version < TERMS_VERSION`, bloquear ações sensíveis (criar/enviar contrato) com modal "aceite os novos termos".

**3.3 Operação**
- Server route `src/routes/api/public/health.ts` retornando `{ ok: true, commit }`.
- Smoke test manual com Playwright headless: signup → checkout PIX (modo sandbox) → simular webhook → criar contrato → enviar Autentique → simular webhook assinatura → financeiro atualiza.
- `preview_ui--publish` pra `intermo.lovable.app` (depois de `security--get_scan_results` limpo + revisão de OG tags).

---

### Itens explicitamente fora do escopo

- NFS continua fora do menu (rota com ComingSoon).
- Reembolso continua manual (mailto/painel AbacatePay).
- Domínio próprio: instruções DNS depois, sem bloquear go-live.
- Sentry/observabilidade externa: ficamos com `last_error` + página admin.

---

### O que vou precisar de você

- Confirmar nome do remetente/subdomínio de e-mail (ex.: `notify.intermo.com.br`) ou aceitar publicar primeiro em `.lovable.app` e configurar o domínio depois.
- Provider Google: confirma que quer login social com Google já no v1 (sem isso o botão fica off).
- Versão dos Termos atual (string tipo `2026-06-01`) — uso pra `TERMS_VERSION` e revalidar aceite.

Aprovando, começo pelo 2.1 (admin) e 2.2 (e-mails), que são os bloqueadores de suporte e comunicação.
