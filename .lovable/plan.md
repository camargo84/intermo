## O que vamos construir

### 1. Filtros e busca na lista de contratos
Em `src/routes/_authenticated/contratos.index.tsx`:
- Adicionar filtro por status (Todos, Rascunho, Enviado, Assinado, Recusado, Expirado, Erro) como `<Select>` shadcn.
- Adicionar campo de busca por título (`<Input>` com ícone) que filtra também por nome/e-mail do cliente.
- Estado vive em search params via `validateSearch` (`status`, `q`) usando `zodValidator` + `fallback`, pra busca ser compartilhável e sobreviver a recargas.
- Filtragem feita no cliente (lista já carrega até 100 contratos).
- Cada item vira `<Link to="/contratos/$contractId">` apontando pra página de detalhes.

### 2. Nova tabela de histórico de eventos
Migração criando `public.contract_events`:
- Campos de domínio: `contract_id` (FK → contracts), `event_type` (text), `status` (text, opcional), `signer_email` (text, opcional), `payload` (jsonb), `message` (text, opcional).
- RLS: dono do contrato pode ler (via subselect em `contracts.user_id = auth.uid()`); apenas `service_role` escreve (webhook + ações do servidor).
- GRANT `SELECT` para `authenticated`, `ALL` para `service_role`.
- Índice em `(contract_id, created_at desc)`.

O webhook e as ações do servidor passam a inserir um registro a cada transição/evento relevante (envio, assinatura, recusa, expiração, erro, reenvio).

### 3. Página de detalhes do contrato
Nova rota `src/routes/_authenticated/contratos.$contractId.tsx` mostrando:
- Cabeçalho: título, status badge, datas (criado, enviado, assinado), valor, cliente.
- Card "Assinantes": lista de `autentique_signers` com nome, e-mail, link de assinatura, `signed_at`/`rejected_at`.
- Card "Histórico": linha do tempo dos eventos vindos de `contract_events` (mais recente primeiro), com ícone por tipo.
- Card "Erro": mostra `last_error` quando houver, com botão "Reenviar pra Autentique" (ver item 4).

Servidor novo em `src/lib/contracts.functions.ts`:
- `getContract({ contractId })`: retorna o contrato + seus eventos (RLS garante isolamento).

### 4. Ação de reenvio quando status = error
- Server fn nova `resendContract({ contractId })` em `contracts.functions.ts`:
  - Carrega contrato, valida que `status === 'error'`.
  - Limpa `autentique_document_id`, `autentique_signers`, `last_error`, `sent_at` e volta `status` pra `draft`.
  - Insere evento `resend_requested` em `contract_events`.
  - Reusa a lógica de envio chamando uma função interna compartilhada (extraída de `sendContractToAutentique` pra não duplicar) que cria o PDF, envia pra Autentique e atualiza o contrato.
- Botão aparece na página de detalhes e (opcionalmente) como ação inline na lista quando `status === 'error'`.
- Mostra toast de sucesso/erro e invalida as queries `contracts` e `contract:{id}`.

### 5. Webhook robusto pra payload de um único signer
Em `src/routes/api/public/autentique-webhook.$.tsx`:
- `mergeSigners`: já mescla snapshot vs patch único; ajustar pra preservar `public_id` no `SignerRecord` (passa a fazer parte do tipo, não usa `@ts-expect-error`) e casar por `public_id` primeiro, e-mail como fallback.
- `buildPatch`:
  - Em evento de assinatura única (`signature.signed`), só marca `status = 'signed'` quando TODOS os signers do array mesclado têm `signed_at` preenchido. Senão, mantém `status` atual e só atualiza `autentique_signers`.
  - `signed_at` do contrato = maior `signed_at` entre todos os signers (último a assinar).
  - Em rejeição/expiração de um signer único, aplica direto (qualquer recusa já invalida o contrato).
- Sempre inserir um registro em `contract_events` (event_type vindo do payload, `signer_email` quando aplicável, `payload` cru truncado).
- Carrega `autentique_signers` atualizado pra calcular a condição de "todos assinaram".

## Detalhes técnicos

- Search params: `z.object({ status: fallback(z.enum([...statuses, 'all']), 'all').default('all'), q: fallback(z.string(), '').default('') })`.
- Rota dinâmica: `contratos.$contractId.tsx` com `Route.useParams()`; loader usa `context.queryClient.ensureQueryData` chamando `getContract` via `useServerFn` no componente (não no loader, pra evitar prerender de rota autenticada — mesma convenção atual).
- `errorComponent` e `notFoundComponent` na nova rota (404 quando contrato não existe ou não é do usuário).
- `resendContract` e `sendContractToAutentique` compartilham um helper `dispatchToAutentique(contract, supabase)` no mesmo arquivo (não é módulo `.server.ts` à parte porque já roda só no servidor pelo `requireSupabaseAuth`).
- Webhook continua usando `supabaseAdmin` (carregado dentro do handler), agora também inserindo em `contract_events`.
- Tipos do Supabase serão regenerados após a migração aprovada antes do código que lê `contract_events` ser escrito.

## Fora de escopo

- Paginação server-side (lista ainda cabe em 100).
- Edição de contrato após criado.
- Notificações por e-mail ao usuário em eventos do webhook.
