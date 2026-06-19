## Execução aprovada

**Já executado nesta etapa (operação de dados, permitida em plan mode):**
- Assinatura ativa criada para `tiago84@gmail.com`: `provider='manual'`, `status='active'`, `amount_cents=11900`, `current_period_end = now() + 30 dias`, `last_payment_at = now()`, `monthly_contract_quota=2000`, metadata marcada como `source='manual_activation'`.
- Papel `admin` concedido em `public.user_roles` para o mesmo usuário.
- Anotado: assinatura `manual` testa apenas o USO. O fluxo real AbacatePay (checkout → webhook → ativação) precisa de teste próprio depois, com conta limpa.

**A executar quando o modo build for liberado (apenas edição de texto, sem mudança de lógica):**

1. `src/routes/_authenticated/assinatura.tsx` — linha 130
   - De: `Até 200 contratos enviados por mês via Autentique`
   - Para: `Contratos e assinaturas digitais ilimitados via Autentique`

2. Varredura confirmada — nenhuma outra ocorrência de "200 contratos" / "Até 200" / "limite mensal" / "limite de contratos" voltada ao usuário foi encontrada:
   - `src/routes/index.tsx` (landing): já diz "Contratos ilimitados" nas features e "No plano inTermo os contratos e assinaturas são ilimitados" no FAQ + JSON-LD.
   - `src/routes/_authenticated/dashboard.tsx`: sem texto de limite.
   - `src/routes/termos.tsx`: sem número fixo público; já alinhado com "ilimitado + anti-abuso".
   - As menções restantes a "limite de contratos" são apenas as perguntas do FAQ ("Tem limite de contratos?") com resposta "Não, é ilimitado" — corretas, mantidas.

**Validação ponta a ponta (você, em aba anônima):**
- Login com `tiago84@gmail.com` → menu lateral mostra "Chat com IA".
- Banner de "assinar plano" não aparece (assinatura ativa).
- Página `/assinatura` mostra status ativo, próxima cobrança em 30 dias, e o item "Contratos e assinaturas digitais ilimitados via Autentique".
- Nenhuma página de usuário menciona "200 contratos".
- Criar 1 cliente pelo chat → gerar contrato → abrir o PDF gerado. Esse caminho usa o cenário "usuário comum pagante", sem qualquer atalho de admin.
- Caso queira testar o admin override depois: cancele a assinatura e refaça o fluxo — as ações vão funcionar mesmo sem `active` e ficarão marcadas em `contract_events` como `actor='admin_override'`.