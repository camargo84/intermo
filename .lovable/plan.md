## O que a API do AbacatePay realmente permite (verificado na docs v2)

Fui na docs antes de prometer. Resultado:

- **Cupom nativo NÃO serve.** O modelo de cupom do AbacatePay é flat: `code`, `discount`, `discountKind` (`PERCENTAGE` ou `FIXED`) e `maxRedeems` (limite **global** de resgates, não por assinatura). **Não existe `durationInCycles` / `duration: repeating` tipo Stripe.** Se eu anexar um cupom de 20% à subscription, ou ele aplica só na 1ª cobrança ou em todas pra sempre — nenhum dos dois é "6 meses depois preço cheio". Opção 1 (cupom nativo) **está descartada**.
- **Crédito de customer não existe** como endpoint público. Op.3 também cai.
- **`POST /subscriptions/change-plan` existe e resolve.** Troca o produto principal de uma assinatura ativa, agendado como `PENDING` e aplicado **automaticamente no início do próximo ciclo**, **mesmo cartão, sem re-checkout, sem interação do cliente**. Exatamente o que você quer.
- **`/subscriptions/create` aceita `externalId`, `metadata`, `customerId`** — dá pra rastrear ciclo perfeitamente.
- **Webhook de assinaturas** dispara em cada cobrança recorrente — o gatilho pra contar ciclos.

## Caminho correto: dois produtos + change-plan automático

### 1. Dois produtos no AbacatePay
- `intermo-mensal-promo-v1` — **R$ 119/mês** (`cycle: MONTHLY`) — produto de boas-vindas
- `intermo-mensal-v1` — **R$ 149/mês** (`cycle: MONTHLY`) — preço cheio

Helpers em `src/lib/abacatepay.server.ts`:
- `ensurePromoProduct()` → garante o de R$119
- `ensureFullProduct()` → garante o de R$149
- `changeSubscriptionPlan(subscriptionId, productId)` → chama `POST /subscriptions/change-plan`

### 2. Migration
```sql
ALTER TABLE public.subscriptions
  ADD COLUMN plan text NOT NULL DEFAULT 'promo',          -- 'promo' | 'full'
  ADD COLUMN promo_cycles_remaining int,                  -- começa em 6
  ADD COLUMN plan_change_scheduled_at timestamptz,        -- quando agendamos o change-plan
  ADD COLUMN last_amount_cents int;                       -- auditoria do valor cobrado
```
Sem backfill (não há assinantes). GRANTs já cobertos.

### 3. `createAbacateCheckout` (`src/lib/subscriptions.functions.ts`)
- Usa **sempre o produto promo (R$119)** pra novos clientes.
- Grava `plan = 'promo'`, `promo_cycles_remaining = 6` no insert da subscription pending.

### 4. Webhook (`src/routes/api/public/abacate-webhook.ts`)
Em `subscription.completed` (1ª cobrança) e cada `subscription.renewed`:
1. Idempotência por `event_id` (já existe).
2. Gravar `last_amount_cents` recebido.
3. Decrementar `promo_cycles_remaining` (cada cobrança = 1 ciclo consumido).
4. **Quando `promo_cycles_remaining == 1`** (ou seja, faltando só a última cobrança promo): chamar `changeSubscriptionPlan(subId, fullProductId)` → AbacatePay agenda como `PENDING` e aplica no próximo ciclo automaticamente. Gravar `plan_change_scheduled_at = now()`.
5. **Quando `promo_cycles_remaining == 0`**: marcar `plan = 'full'`.
6. Idempotência extra: só chama `change-plan` se `plan_change_scheduled_at IS NULL` (não re-agenda se webhook duplicar).

Resultado pro cliente: 6 cobranças de R$119, depois R$149 automático no mesmo cartão.

### 5. UI (`/assinatura` + `SubscriptionBanner.tsx`)
- Card de preço pra quem não assinou:
  - `R$ ~~149~~/mês` riscado + **R$ 119/mês** destaque + badge "20% off · 6 primeiros meses"
  - Subtexto: "Depois desse período, R$ 149/mês no mesmo cartão. Cancele quando quiser."
- CTA: "Assinar por R$ 119/mês"
- Pra usuário ativo no plano promo: "Oferta de boas-vindas · ciclo {6 - remaining + 1} de 6 · próximas cobranças R$ 119, depois R$ 149/mês"
- Pra usuário ativo no plano full: "R$ 149/mês"
- Atualizar todos os textos hardcoded de R$119 hoje.

### 6. Testes (`src/lib/autentique-webhook.logic.test.ts` é o padrão atual)
Criar `abacate-subscription-promo.logic.test.ts`:
- 6 `renewed` consecutivos → 6 decrementos → `change-plan` chamado exatamente 1 vez no 6º (quando `remaining == 1`)
- `renewed` duplicado com mesmo `event_id` → não decrementa de novo, não chama `change-plan` de novo
- `plan` vira `'full'` quando zera

### 7. O que NÃO entra agora
- E-mails de aviso (15d / 3d antes da virada). Fica pra feature separada.
- Painel admin pra gerenciar promo.
- Mudança retroativa de assinantes (não há nenhum).

## Por que isso é melhor que o que eu tinha proposto antes
Você foi direto ao ponto: minha proposta anterior dependia de uma feature de cupom que **não existe nesse gateway**. Esse caminho usa o que a API realmente oferece (`change-plan`), continua 100% transparente pro cliente (mesmo cartão, sem nova compra), e o controle de ciclos vive no nosso banco onde a gente pode auditar.