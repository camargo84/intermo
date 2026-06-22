# Correções do inTermo — plano consolidado (decisões aprovadas)

Decisões confirmadas:
- Escopo: **executar tudo de uma vez** (P0 → P1 → P2 num único passe).
- Termo canônico: **Transação** (remover "Contrato" dos cabeçalhos/menus da app; "contrato" só fica em contextos jurídicos: corpo do PDF, /termos, /assinar/$token).
- GC de rascunhos: janela de **30 dias** (rascunho sem cliente E sem mensagens com >30d é apagado).

---

## P0 — Bloqueios e segurança

### 1. Login: blindar contra vazamento de senha na URL
- `src/routes/login.tsx`: adicionar `method="post"` no `<form>`, manter `onSubmit={handleSubmit(onSubmit)}` (já chama preventDefault via RHF).
- Adicionar `isHydrated` (useEffect → true) e desabilitar "Entrar" enquanto `!isHydrated` para fechar a janela de corrida pré-hidratação.
- Aplicar o mesmo em `src/routes/signup.tsx` e `src/routes/reset-password.tsx`.

### 2. Barra de ações no detalhe da transação (`/transacoes/$contractId`)
- Em `src/routes/_authenticated/transacoes.$contractId.tsx`, adicionar header de ações com:
  - **Enviar para assinatura** (primário) — dispara geração de PDF + envio Autentique (reusar a server fn já usada no chat). Desabilitado quando faltar cliente, valor ou dados essenciais da empresa em `/configuracoes`; tooltip explica o motivo.
  - **Baixar PDF** — link para `contract-pdfs` via signed URL (server fn).
  - **Editar** — leva para `/chat/$contractId` (fluxo conversacional existente).
  - **Excluir** — `AlertDialog` de confirmação; soft/hard delete conforme padrão atual de `transactions`.
- Após envio, invalidar query e gravar evento em `contract_events` para o Histórico refletir.

### 3. Type drift `event_fingerprint`
- Adicionar `event_fingerprint: string | null` em `contract_events` (Row/Insert/Update) em `src/integrations/supabase/types.ts` para `tsc --noEmit` sair 0 sem cast no webhook.

---

## P1 — Integridade de dados

### 4. Parar de criar rascunhos órfãos
- `/chat` index e botão "Nova transação": **não** persistir `transactions` ao abrir; só criar no primeiro `sendMessage` real.
- Corrigir Enter na home do `/chat`: mesma ação cria a conversa **e** envia a 1ª mensagem.
- GC: server fn agendável (chamada manual + cron via `/api/public/cron/gc-drafts` com `CRON_SECRET`) que apaga rascunhos sem `client_name` e sem mensagens com `updated_at < now() - interval '30 days'`. Também faz a limpeza ao logout.

### 5. Travar duplo-envio no chat
- Em `src/routes/_authenticated/chat.$contractId.tsx`: desabilitar input + botão enquanto `status === "submitted" | "streaming"`; bloquear Enter; chave de idempotência por id de mensagem do lado servidor para deduplicar.

### 6. Validar `/configuracoes`
- Schema zod com obrigatórios: `ownerName`, `companyCnpj`, `companyEmail`, `representativeName`, `representativeCpf`, `comarca`.
- Validar no client e na server fn de save.
- Normalizar CNPJ/CPF/CEP para só dígitos antes de gravar; formatar na exibição (helper único). Migration leve para normalizar registros existentes.

### 7. Semântica do `/financeiro`
- KPIs continuam só de transações assinadas.
- Lista do mês em duas seções: **Assinadas** e **Em aberto**, com totais separados.

---

## P2 — i18n, nomenclatura, copy

### 8. Padronização (termo canônico = Transação)
- Substituir "Contrato/Contratos" por "Transação/Transações" em: cabeçalho de `/transacoes`, breadcrumbs, botão "Voltar", `transacoes.$contractId` ("Detalhes da transação"), sidebar, toasts. Manter "contrato" só em /termos, PDF e `/assinar/$token`.
- Adicionar route stub `src/routes/transactions.tsx` que faz `redirect({ to: "/transacoes", statusCode: 301 })` (mesma coisa para `/transactions/$id`).
- Helper único `statusLabel(status)` em PT-BR (`draft→Rascunho`, etc.) usado em `/financeiro`, `/transacoes`, sidebar.
- Default de tema: páginas públicas (landing, /login, /signup, /termos, /privacidade) começam **dark** para alinhar com o app.

### 9. Suavizar copy fiscal do FAQ (landing)
- Reescrever o item do FAQ sobre tributação em condicional: "pode, a depender do enquadramento (regime/CNAE/município) e mediante orientação do seu contador". Deixar claro que a inTermo organiza dados e não presta consultoria fiscal.

---

## Validação final
- `npx tsc --noEmit` → 0.
- Build.
- Checklist no fim com o que ficou pronto vs pendente de produto.

Vou começar pelo P0 e seguir até o P2 sem pausar.
