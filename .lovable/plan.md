
# Fase 1 — Redesign Claude + Chat como hub

Escopo desta rodada conforme aprovado: **só visual, login, sidebar de threads e enxugar o menu**. O fluxo do link público para o cliente, exclusão de contrato com financeiro e notificações ficam para a Fase 2.

## 1. Sistema visual (tokens + tipografia)

Adotar a linguagem do Claude **mantendo o dark como padrão** e a família verde atual como acento.

- Tipografia editorial:
  - Display/headings: **Instrument Serif** (proxy livre do Copernicus/Tiempos) via `@fontsource/instrument-serif`.
  - UI/body: **Inter** (proxy do StyreneB) — já disponível, garantir peso 400/500.
  - Carregar via `<link>` no `__root.tsx` (não `@import` em CSS, conforme Tailwind v4).
- Paleta em `src/styles.css` (mantém verde, adiciona warmth do Claude):
  - `--background`: dark base (mantém oklch atual, levemente mais quente).
  - `--primary`: verde atual (mantém identidade).
  - `--accent-coral`: `oklch(0.68 0.13 40)` (~#cc785c) para CTAs secundários/destaques editoriais.
  - `--surface-soft`, `--surface-card`, `--hairline` no padrão dark-elevated do Claude.
  - Ajustar `--muted-foreground` para tom mais quente.
- Componentes shadcn relevantes (`Button`, `Card`, `Input`, `Sidebar`) ganham variantes mais "calmas": menos sombra, mais hairline, raio 12–14px.

## 2. Menu / Navegação

Sidebar shadcn nova com estrutura inspirada no Claude:

```text
[Logo inTermo]            [collapse]
+ Nova conversa
💬 Conversas        ← lista de threads (chat_threads)
   • thread 1
   • thread 2
   ...
─────────
📊 Dashboard
💰 Financeiro
📄 Contratos        ← (vira leitura/histórico, sem botão "novo")
─────────
💳 Assinatura
⚙️  Configurações
[avatar + empresa] ← rodapé
```

Removidos do menu: **"Novo contrato"** e o card de criação manual. Tudo passa a ser disparado pelo chat. A rota `/contratos/novo` é mantida apenas como destino interno (caso o chat queira abrir o form), mas sai da navegação.

## 3. Tela de login (`/auth`)

Refazer no estilo split-screen do Claude:

- Esquerda: canvas com headline serif grande ("Contratos de intermediação, sem fricção." ou similar), subheadline curta, botão Google + e-mail.
- Direita: card escuro mostrando preview de uma conversa real do chat criando um contrato (mock estático, igual o Claude mostra o Cowork).
- Mantém Google OAuth + magic link já existentes — só refaz a casca visual.

## 4. Chat como hub central

- Rota `/chat` (`chat.index.tsx`) vira a **home autenticada padrão** (redirect do `/` autenticado para `/chat` quando não há thread ativa, ou pra última thread).
- `chat.$contractId.tsx` continua sendo o conversation viewer, mas a sidebar de threads (chat_threads) entra como navegação primária.
- Cada item da sidebar = uma thread; clicar abre a rota da thread. Botão **"+ Nova conversa"** chama `createDraftContractForChat` e navega.
- Empty state grande no centro com prompt suggestions (estilo Claude): "Criar contrato de iPhone", "Conferir últimos contratos", etc — todos enviam mensagem inicial pro chat.
- Composer com AI Elements (`PromptInput`, `PromptInputTextarea`, `PromptInputFooter` + submit) — segue o `chat-ui-composition`.
- Mensagens do assistente sem bubble (texto direto no canvas), mensagens do usuário em bubble `primary`.

## 5. Detalhes técnicos

- Novo `src/components/shell/ClaudeSidebar.tsx` (substitui `AppSidebar` para usuários autenticados; o `AppSidebar` atual é arquivado).
- `chat.index.tsx` carrega `listMyChatThreads` no loader (via `useServerFn` + `useQuery`, não em loader de rota pública — segue regra do `auth-protected-server-functions`).
- Renomear thread: já temos `chat_threads.title` — adicionar pequena ação inline (lápis) na sidebar, salva via novo `renameChatThread` server function (curto, ~10 linhas).
- Login: `src/routes/auth.tsx` + `src/components/auth/AuthLayout.tsx` repaginados.
- Tokens em `src/styles.css`; tipografia via `@fontsource/instrument-serif` (`bun add`).
- **Nada de tocar** em: AbacatePay, Autentique, webhooks, contratos pdf, RLS, migrations.

## Validação ao final

1. `/auth` em aba anônima: split-screen, serifa grande, Google + e-mail funcionando.
2. Após login: cai em `/chat` com sidebar nova; menu sem "Novo contrato".
3. Criar uma conversa, voltar, ver thread persistida na sidebar.
4. Dashboard/Financeiro/Contratos/Assinatura/Configurações ainda acessíveis pelo menu e funcionando.
5. Dark mode preservado; toggle de tema funciona.

## Fora de escopo (Fase 2, registrado)

- Link público assinado para o cliente preencher dados (sem signup).
- Wa.me com mensagem pronta.
- Notificação no chat quando o cliente retorna o formulário.
- Exclusão de contrato com confirmação para apagar lançamentos financeiros.
- Refatorar fluxo da IA para perguntar **produto antes das partes**.
- Banir "venda" do copy em todos os lugares (chat, contrato, UI).
