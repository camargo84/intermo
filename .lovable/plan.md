
Duas frentes independentes: **(1) Sidebar de conversas** e **(2) Upload da logo com recorte**. Sem mudança de regra de negócio — só UX e apresentação.

---

## 1. Sidebar — quando atualizar e o que mostrar

### 1.1 Quando o label atualiza (jornada)

Cascata de gatilhos, do mais barato pro mais informativo:

1. Criou a thread → `Rascunho · 23/abr 14:32`
2. Agente extrai/confirma o **produto** → `Rascunho | {Produto} · 23/abr 14:32`
3. Cliente cadastrado/linkado → `{Cliente abreviado} | {Produto} · 23/abr 14:32`
4. Consolidado → mesma label, com ponto verde no ícone

**Abreviação do nome** — helper em `src/lib/format.ts`:
- "Thales Carlos Gomes Silva" → `Thales C. G. Silva`
- "Thales Gomes Silva" → `Thales G. Silva`
- "Maria Silva" → `Maria Silva` (só 2 partes)
- "de/da/do/dos/das" ignorados

**Formato final** (separador `|` confirmado):
```
Thales C. G. Silva | Persiana Rolô · 23/abr 14:32
```
- Data/hora: relativa quando ≤ 7 dias (`hoje 14:32`, `ontem 09:10`, `qua 16:40`), absoluta depois (`23/abr 14:32`, com ano se diferente).

**Efeito letreiro (marquee)**: só no hover *e somente se* o texto está realmente truncado (mede `scrollWidth > clientWidth`). CSS puro, 1 ciclo 6–8s, pausa em `prefers-reduced-motion`.

### 1.2 Busca na sidebar (títulos + conteúdo)

- Campo de busca fixo abaixo de "Nova transação" (ícone `Search`, atalho `⌘K` / `Ctrl+K`).
- Novo server fn `searchMyChatThreads({ q, limit })` com `ilike` em `transactions.client_name`, `transactions.title` e `chat_threads.messages::text`. Escopo por `user_id` via RLS.
- Migration de índices: `GIN (to_tsvector('portuguese', messages::text))` em `chat_threads`; trigram em `transactions.client_name`.
- Pré-carregamento: prefetch da query com `q=""` ao montar (warm cache/planner). Busca acontece no servidor com debounce 250ms.
- Cobre **todas** as transações do usuário, independente do que está na lista visível. Resultados num painel sobreposto enquanto o input está focado.

### 1.3 Scroll infinito

- `useInfiniteQuery`, páginas de 30, ordem `updated_at desc`.
- Sentinela com `IntersectionObserver`.
- Virtualização (`@tanstack/react-virtual`) só se passar de ~200 itens.

### 1.4 Largura redimensionável + persistência

- Handle de drag na borda direita do `<Sidebar>` (8px hit area), livre entre **220px** e **440px**.
- Atalhos `Ctrl/⌘ + [` e `Ctrl/⌘ + ]` para −10% / +10%.
- Persistir em `localStorage` (`intermo.sidebar.width`), leitura síncrona via inline script no `__root.tsx` pra evitar flash. Fallback 280px.
- Collapsed/expanded continua no cookie do shadcn-sidebar (não mexer).

---

## 2. Upload de logo com recorte

Tela `configuracoes.tsx` ganha modal `Recortar logo` no fluxo do upload atual:

- `react-easy-crop` para drag/zoom (mouse + pinch).
- Botão **"Recortar automaticamente"**: no cliente, varre alpha > 0 (ou luminância < 250 sobre branco) e ajusta o bounding box. Cobre logo com fundo branco/transparente.
- Razão livre, com preset "ajustar pro cabeçalho" (~4:1).
- "Confirmar" gera PNG ≤ 800px no maior lado e manda via `uploadMyLogo` (server fn intacta).

### 2.1 Linhas do cabeçalho/rodapé do PDF

Confirmar em `contracts.pdf.server.ts` que as linhas usam `rgb(0,0,0)` — se já estão pretas, não mexo; se não, ajusto. Adicionar teste de regressão lendo o PDF e validando uma linha preta no header e outra no footer.

---

## Pedaços técnicos

```
src/
  lib/
    format.ts              + abbreviateName(), formatThreadTimestamp()
    chat.functions.ts      + searchMyChatThreads({ q, limit, cursor })
                           ~ listMyChatThreads aceita cursor/limit
  components/shell/
    ClaudeSidebar.tsx      ~ busca, infinite scroll, resize handle, label nova
    SidebarResizer.tsx     + handle de drag + atalhos
    ThreadLabel.tsx        + label com marquee on hover
  components/profile/
    LogoCropDialog.tsx     + recorte/zoom/auto-crop
  routes/_authenticated/
    configuracoes.tsx      ~ integra LogoCropDialog
supabase migration:
  - idx GIN sobre to_tsvector('portuguese', chat_threads.messages::text)
  - idx trigram em transactions.client_name
```

Dependência nova: `react-easy-crop` (~15kB). `@tanstack/react-virtual` só se virarmos a chave.

---

## Fora deste PR

- Não vamos materializar a label na coluna `transactions` — derivação fica só na UI.
- Sem ranking estilo Algolia; `ilike` + `tsvector` resolve no volume atual.

---

## Rodada 4 — IMPLEMENTADO

- Sidebar: label "Cliente | Produto · data" (helpers `abbreviateName`, `formatThreadTimestamp` em `src/lib/format.ts`); marquee on hover quando trunca (`ThreadLabel.tsx` + `@keyframes marquee` em `styles.css`).
- Sidebar: busca server-side cobrindo client_name/title/messages (`searchMyChatThreads` em `src/lib/chat.functions.ts`); debounce 250ms.
- Sidebar: scroll infinito via `useInfiniteQuery` (`listMyChatThreads` agora aceita `{limit,cursor}` e retorna `nextCursor`).
- Sidebar: largura redimensionável (220–440px) com handle, atalhos Ctrl/⌘+[ / ], duplo-clique reseta, persistido em `localStorage` (`AppShell.tsx`).
- Migration: GIN tsvector('portuguese') sobre `chat_threads.messages::text`, trigram em `transactions.client_name` e `transactions.title`.
- Logo: `LogoCropDialog` com `react-easy-crop` — drag/zoom, preset 4:1 cabeçalho, "Recortar automaticamente" (bbox por alpha/luminância) e clamp a 800px no maior lado; configuracoes.tsx integrado.
- PDF: linhas de separação do cabeçalho e do rodapé agora em `rgb(0,0,0)` (preto) — `src/lib/contracts.pdf.server.ts`.
