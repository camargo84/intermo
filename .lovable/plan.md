## Decisões assumidas (escolhi pelo menor custo de manutenção)

| Item | Escolha | Por quê |
|---|---|---|
| Pagamento | **AbacatePay** (PIX recorrente + cartão) via API + webhook | Pedido do usuário; provedor BR, sem MOR estrangeiro |
| Modelo de cobrança | **Cobrar e reembolsar em até 7 dias** se pedido | PIX não suporta "trial gratuito" nativo; reembolso manual é raro e simples |
| NFS | **Escondido da v1** (rota fica, fora do menu) | Integração fiscal é projeto à parte, gera ticket pesado |
| Financeiro v1 | Receita do mês e margem; **remove "DAS estimado"** | Cálculo tributário depende de regime; promete suporte que não queremos |
| Auth | E-mail/senha + Google + **HIBP ligado** + confirmação obrigatória | Padrão Lovable, menos reset de senha vazada |
| Domínio | Publica em `.lovable.app` primeiro, domínio próprio depois | Destrava go-live sem esperar DNS |
| E-mails | Lovable Email com subdomínio `notify.<dominio>` (quando o domínio vier) | Menos manutenção que SMTP próprio |
| Observabilidade | `last_error` já existe + página admin de falhas | Não introduzir Sentry externo agora |

Se algo aí estiver errado, me corrige antes de eu começar.

---

## Plano de produção (3 sprints)

### Sprint 1 — Receita destravada (bloqueador)

**1.1 Tabela `profiles` + trigger**
- Migração: `public.profiles` (`id` PK→`auth.users.id`, `owner_name`, `company_fantasy_name`, `company_legal_name`, `company_cnpj` UNIQUE, `company_email`, `company_phone`, `accepted_terms_at`, `accepted_terms_version`, timestamps).
- Trigger `on_auth_user_created` copia `raw_user_meta_data` → `profiles`.
- RLS: dono lê/edita só o próprio. GRANTs `authenticated` + `service_role`.
- Migrar `configuracoes` para editar `profiles` (não `user_metadata`).
- `createContract` passa a popular emissor a partir do `profiles`.

**1.2 AbacatePay — assinatura R$ 119/mês**
- Pedir secrets via `add_secret`: `ABACATEPAY_API_KEY`, `ABACATEPAY_WEBHOOK_SECRET`.
- Tabela `public.subscriptions` (`user_id` UNIQUE, `provider='abacatepay'`, `customer_id`, `subscription_id`, `status` ∈ {`pending`,`active`,`past_due`,`canceled`,`refunded`}, `current_period_end`, `last_payment_at`, `cancel_at`, timestamps). RLS: dono SELECT; service_role ALL.
- Server fn `createAbacateCheckout` (autenticada): cria/recupera customer, cria cobrança mensal R$ 119, devolve URL de pagamento (PIX QR / link).
- Server route pública `/api/public/abacate-webhook`: verifica assinatura HMAC com `ABACATEPAY_WEBHOOK_SECRET`, atualiza `subscriptions` por evento (`billing.paid`, `billing.failed`, `subscription.canceled`, `refund.created`). Idempotente por `event_id` em tabela `webhook_events`.
- Server fn `cancelSubscription` e `getMySubscription`.

**1.3 Guard de acesso por assinatura**
- Helper SQL/`has_active_subscription(uid)` SECURITY DEFINER.
- Server fn `createContract` e `sendContractToAutentique` rejeitam quando `status` ∉ {`active`}.
- UI: banner persistente em `_authenticated` quando sem assinatura ativa → CTA "Reativar".
- Fluxo signup: após criar conta → redireciona para `/_authenticated/assinatura` (página nova) com o checkout PIX embedado.

**1.4 Página `configuracoes` → aba Assinatura**
- Status, próxima cobrança, última cobrança, botão "Cancelar assinatura", botão "Solicitar reembolso (7 dias)" (abre mailto/ticket — operacional, sem automação).

### Sprint 2 — Confiança e operação

**2.1 Papéis (admin para suporte)**
- Enum `app_role` + tabela `user_roles` + função `has_role()` (padrão Lovable).
- Layout `_authenticated/_admin/route.tsx` com gate `has_role('admin')`.
- Página `_admin/contratos-falha`: lista `contracts.status='error'` com `last_error`.
- Página `_admin/assinaturas`: status agregado.

**2.2 Quota mensal real**
- Coluna `monthly_contract_quota` (default 200) em `subscriptions`.
- RPC `current_month_contract_count()` para o usuário logado.
- Dashboard troca dados mock por dados reais.
- `createContract` bloqueia quando `count >= quota`; UI mostra aviso a partir de 80%.

**2.3 E-mails transacionais (Lovable Email)**
- Templates: confirmação de cadastro, reset de senha, "contrato enviado", "contrato assinado", "pagamento falhou".
- Disparo no webhook AbacatePay (falha) e webhook Autentique (enviado/assinado).
- Domínio de envio fica para quando o cliente trouxer o domínio próprio.

**2.4 Hardening**
- `configure_auth`: HIBP on, confirm e-mail obrigatório.
- `configure_social_auth`: Google.
- Rate-limit por user_id em `createContract` e `createAbacateCheckout` (tabela `rate_limits` + check no início do handler).
- Confirmar verificação timing-safe no webhook Autentique (auditar `autentique-webhook.$.tsx`).
- `security--run_security_scan` + tratar críticos.

### Sprint 3 — Polimento e go-live

**3.1 Páginas funcionais**
- **Financeiro**: soma `value_cents` de contratos `signed` no mês corrente + acumulado do ano + margem (configurável em `profiles.default_margin_pct`). Remove card DAS.
- **NFS**: tirar do menu (manter rota com ComingSoon para reativar depois).

**3.2 SEO / OG**
- `head()` por rota pública com `og:title`, `og:description`, `og:image`, twitter card.
- `robots.txt` + `sitemap.xml` via server route `/api/public/sitemap.xml`.

**3.3 LGPD + termos**
- Banner cookies (aceitar/recusar analytics).
- `accepted_terms_version` em `profiles`; bloquear ação se versão atual > aceita.

**3.4 Operação e go-live**
- Server route `/api/public/health` (200 + commit).
- Smoke test ponta a ponta: signup → checkout PIX → webhook → criar contrato → enviar Autentique → webhook assinatura → financeiro atualiza.
- `preview_ui--publish` para `intermo.lovable.app`.
- Configurar domínio próprio depois (instruções DNS).

---

## Resumo dos riscos que ficam para o cliente

1. **AbacatePay não tem cobrança recorrente automática em todos os planos** — se a API for one-shot, vamos precisar agendar geração de fatura mensal via `pg_cron` (incluído no Sprint 1 se necessário; verifico na implementação).
2. **Reembolso é manual** — operação responde por e-mail e estorna no painel AbacatePay; nada de UI para isso na v1.
3. **NFS off** — comunicar nos Termos que NFS é responsabilidade do cliente nesta versão.
4. **DAS removido do dashboard** — evitar promessa de cálculo fiscal.

---

## O que vou precisar de você quando o plano for aprovado

- Conta AbacatePay criada e a **API key** + **webhook secret** (pedirei via `add_secret`, não cola aqui no chat).
- Confirmar o nome do produto que aparece na fatura ("Intermo — Assinatura mensal").
- Domínio próprio (opcional na v1).

Aprova esse plano que eu começo pelo Sprint 1.