# Correções do inTermo — achados do teste de estresse

Sim, li os dois arquivos (achados-2.md + MEGACOMANDO_LOVABLE-2.md). Abaixo o plano dividido em ondas, por prioridade. Posso executar tudo em sequência ou só uma onda — me diga.

## P0 — Bloqueios e segurança

### 1. Login: blindar contra vazamento de senha na URL (`/login`)
- `src/routes/login.tsx`: adicionar `method="post"` no `<form>` (hoje só tem `onSubmit`), garantir `e.preventDefault()` ainda que o handler do react-hook-form já faça isso.
- Adicionar estado `isHydrated` (set em `useEffect`) e desabilitar o botão "Entrar" enquanto `!isHydrated` — fecha a janela de corrida pré-hidratação.
- Aplicar o mesmo blindagem em `signup.tsx` e `reset-password.tsx`.

### 2. Barra de ações no detalhe da transação (`/transacoes/$contractId`)
- Em `src/routes/_authenticated/transacoes.$contractId.tsx`: adicionar header com botões **Enviar para assinatura** (primário), **Baixar PDF**, **Editar**, **Excluir** (com `AlertDialog` de confirmação).
- "Enviar para assinatura" desabilitado quando faltar cliente, valor ou dados da empresa em `/configuracoes` — tooltip mostra o motivo.
- Reusar a server function/fluxo Autentique já existente no chat; após envio, atualizar status e gravar evento em `contract_events` para aparecer no Histórico.

### 3. Type drift `event_fingerprint`
- Adicionar `event_fingerprint: string | null` ao tipo `contract_events` (Insert/Row/Update) em `src/integrations/supabase/types.ts` para `tsc --noEmit` sair 0 sem cast no webhook.

## P1 — Integridade de dados

### 4. Parar de criar rascunhos órfãos (criação lazy + GC)
- `/chat` (index) e botão "Nova transação": só criar a row em `transactions` no primeiro `sendMessage` real; antes disso manter estado local.
- Corrigir Enter na home do `/chat`: criar conversa **E** enviar a 1ª mensagem na mesma ação (hoje cria UUID vazio).
- Migration: job/edge function que apaga rascunhos sem cliente e sem mensagens com >24h (ou no logout). Decidir janela com o usuário; padrão sugerido: 24h.

### 5. Travar duplo-envio no chat (`/chat/$contractId`)
- Desabilitar botão e input enquanto `status === "submitted" | "streaming"`.
- Bloquear Enter quando já houver request em voo; idempotência por id de mensagem para evitar 2 inserts.

### 6. Validação em `/configuracoes`
- Marcar como obrigatórios: ownerName, companyCnpj, companyEmail, representativeCpf, representativeName, comarca (lista exata a confirmar).
- Validar no client (zod) e no server function que persiste.
- Normalizar CNPJ/CPF/CEP guardando apenas dígitos; formatar só na exibição. Migration leve para normalizar registros existentes.

### 7. Semântica do `/financeiro`
- KPIs continuam só de assinadas.
- Lista do mês passa a ter duas seções (ou filtro de status): **Assinadas** e **Em aberto**, deixando claro que receita ≠ lista.

## P2 — i18n, nomenclatura, copy

### 8. Padronização
- Adicionar redirect 301 `/transactions → /transacoes` (rota stub que chama `redirect`).
- Definir termo canônico **Transação** (já é o do menu e do modelo) e atualizar cabeçalho/textos de `/transacoes` que ainda dizem "Contrato".
- Mapear enum `draft → Rascunho` (e demais status) num helper único usado em `/financeiro`, `/transacoes`, sidebar.
- Default de tema das páginas públicas: dark-first, alinhado ao app.

### 9. Suavizar copy fiscal do FAQ (landing)
- Reescrever o item do FAQ sobre tributação em tom condicional, citando regime/CNAE/município e orientação do contador; deixar claro que inTermo organiza dados e não presta consultoria fiscal.

## Validação final
- Rodar `npx tsc --noEmit` (deve sair 0) e o build.
- Devolver checklist com itens concluídos vs itens que ainda dependem de decisão de produto (ex.: janela do GC de rascunhos, termo canônico final).

## Perguntas antes de implementar
1. Posso tocar tudo de uma vez ou prefere começar só pela P0?
2. Termo canônico: confirma **Transação** (e eu removo "Contrato" dos cabeçalhos)?
3. GC de rascunhos: janela de 24h ok, ou prefere outro valor / só no logout?
