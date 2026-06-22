## Resumo da investigação

Verifiquei o estado real antes de planejar:

- **Banco**: não há nenhum cliente com CPF inválido. Os 2 clientes existentes (`52998224725` João, `12345678909` Maria) passam DV. A regra `validateCPF` já rejeita sequências repetidas (`/^(\d)\1{10}$/`). Validação CPF/CNPJ já roda ANTES do `INSERT` tanto em `src/lib/clients.functions.ts:46-48` (`upsertClient`) quanto em `src/routes/api/chat.tsx:131-133` (tool `upsert_cliente`).
- **Perfil**: completo e válido. `representative_cpf` está preenchido, `comarca` ok. Portanto `checkProfileReadiness` retorna `ready=true`.
- **Botão "Enviar para assinatura"**: a razão real do disabled é `client_email` vazio. `contractInsertCore` em `src/routes/api/chat.tsx:413` insere `client_email: ""` hard-coded e `transacoes.$contractId.tsx:233` exige email não vazio. O e-mail está no `clients.email` mas nunca é copiado para a transação.
- **Topbar**: lê `user_metadata` (signup), não a tabela `profiles`. Edições em `/configuracoes` não refletem.
- **Duplicação no chat**: o cliente cria draft via `createDraftContractForChat`, mas `contractInsertCore` faz um `INSERT` novo em vez de promover o `contractId` da thread atual. Dedupe atual (2min, mesmo client) só pega rajadas.
- **Primeira mensagem**: `chat.index.tsx` grava em `sessionStorage("chat:initial:<id>")`. Precisa confirmar que `chat.$contractId.tsx` lê e dispara como primeiro `sendMessage` real (não como placeholder).

## Plano (Parte A — corrigir)

### 1. CPF/CNPJ validado antes do INSERT (item 1)
Já está correto em ambos os pontos de entrada. **Sem mudança de código**. Vou reportar no fim com `arquivo:linha` da validação.

### 2. Cleanup do registro sujo (item 2)
Query confirma **0 linhas inválidas** hoje. Antes de qualquer DELETE eu rodo:
```sql
SELECT id, user_id, name, cpf, cnpj FROM public.clients
WHERE (cpf IS NOT NULL AND (length(cpf) <> 11 OR cpf ~ '^(\d)\1{10}$'))
   OR (cnpj IS NOT NULL AND (length(cnpj) <> 14 OR cnpj ~ '^(\d)\1{13}$'));
```
e listo para você. **Só aplico migration de DELETE se a lista vier não-vazia e você confirmar.** Independente disso, adiciono migration defensiva com CHECK constraint via trigger (não CHECK, porque o validador usa lógica de DV) — opcional: pulo se preferir manter só a validação na app.

### 3. Primeira mensagem do chat (item 3)
Auditar `chat.$contractId.tsx`: ler `sessionStorage("chat:initial:<id>")` no mount, fazer `sendMessage({ text })` UMA vez, e limpar a chave. Hoje o STARTER_PROMPT do botão sobrescreve a redação real do usuário. Garantir que `start(input)` em `chat.index.tsx` sempre passa o texto digitado (já passa), e que o handler do ChatView consome `chat:initial` em vez de injetar placeholder.

### 4. Promover rascunho em vez de duplicar (item 4)
Em `src/routes/api/chat.tsx`:
- O tool `criar_contrato` recebe o `contractId` da thread (já vem em `body.contractId`).
- Reescrever `contractInsertCore` para: se `body.contractId` aponta para um draft do usuário SEM `client_id`, fazer `UPDATE` (preencher `client_id`, `title`, `content`, `produtos`, `value_cents`, `forma_pagamento`, `entrada_cents`, `tenant_snapshot`, `client_name`, `client_email`) em vez de `INSERT`.
- Se já tiver `client_id` ou não for draft, manter dedupe atual.
- Remover dedupe por 2min (vira redundante).

### 5. Botão habilitar com perfil completo (item 5)
Causa raiz: `transactions.client_email = ""`. Fix em duas pontas:
- `contractInsertCore` (chat) e `criarContrato` (`src/lib/agent.functions.ts`): popular `client_email` e `client_doc` a partir da tabela `clients` (`cli.email`, `cli.cpf ?? cli.cnpj`) no momento do insert/update.
- Em `transacoes.$contractId.tsx`, derivar `clientEmail` do `clients.email` via join no `getChatThread`/`getContract` se a transação ainda estiver vazia (fallback defensivo, retroativo às transações já criadas).

### 6. Tooltip acessível (item 6)
O `<Tooltip>` já mostra `sendDisabledReason`. Falta a11y: adicionar `aria-describedby` no `<Button>` apontando para um `<span id sr-only>` com `sendDisabledReason`, e `title={sendDisabledReason}` como fallback nativo. Manter o `<TooltipContent>` existente.

### 7. Header com nome correto (item 7)
`Topbar` deve consultar `profiles` em vez de `user_metadata`. Trocar o `useEffect` por `useQuery` chamando uma serverFn nova (ou reaproveitar `getMyProfile` se existir) que retorna `{ company_fantasy_name, company_legal_name, owner_name, email }`. Fallback para `user_metadata` só se profile estiver vazio. Invalida no `onAuthStateChange` (já wired).

## Plano (Parte B — investigar e reportar, sem fix automático)

### 8. Export financeiro XLSX
Vou ler `exportFinanceiroXlsx` (`src/lib/financeiro.functions.ts`) por completo e verificar:
- Cálculo da margem: hoje usa `r.margin_cents` direto da row (calculado no banco). Conferir se é receita-custo-frete e se UI bate.
- Divisão por zero: ver se há razão margem/receita em algum agregado.
- Join: já usa `client:clients(...)` — confirmar se o filtro `consolidated=true` mais a fix do item 4 elimina duplicidade.

### 9. Markdown / máscara de CPF
Já há `sanitizeMarkdown` em `src/lib/markdown.ts` com regex `/[\d*_./-]+/g` que escapa `*`/`_` quando a run tem dígitos. Vou:
- Confirmar uso em todas as renderizações de mensagem do assistente (`chat.$contractId.tsx`).
- Conferir caso `**Cliente:** João` (palavras puras, sem dígito) — deve passar intacto.
- Adicionar 1-2 testes em `src/lib/markdown.test.ts` se ainda não cobrem `***.***.123-45` e `**Cliente:**` no mesmo texto.

### 10. Validators CPF/CNPJ (módulo)
Auditar `src/lib/validators.ts` (já lido):
- DV inválido: coberto.
- Sequências repetidas: coberto.
- Tamanho errado: coberto (`length !== 11/14`).
- Resto 10/11 mod 11: coberto (`r === 10 ? 0 : r` e `r < 2 ? 0 : 11 - r`).
Vou rodar `src/lib/validators-documentos.test.ts` e reportar; se faltar caso de resto=10, adiciono teste (sem alterar lógica).

## Migrations / SQL a confirmar antes de aplicar

1. **(condicional)** `DELETE FROM clients WHERE <regras de inválido>` — só se o SELECT do item 2 retornar linhas.

Nenhuma alteração de schema; sem novas tabelas/políticas.

## Não vou tocar (lista travada)

Máscara de CPF na exibição; conversão monetária (cents); criação lazy; action bar; financeiro Assinadas/Em aberto; redirect `/transactions`; URL assinada do PDF (~10min).

## Entregável final

Relatório item-a-item: o que mudou, `arquivo:linha`, e resultado da investigação 8–10 (com diffs propostos ou "nada a corrigir").
