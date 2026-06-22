# Relatório item-a-item + plano de ação

## D1 — CPF inválido pelo chat (REPRODUZIDO, fix proposto)

**Diagnóstico (não é otimismo do frontend, é label do tool-call):**

- `src/routes/api/chat.tsx:127-132` — a tool `upsert_cliente` valida CPF/CNPJ **antes** de qualquer `insert`/`update`. Quando inválido, retorna `{ error: "CPF inválido." }` sem tocar no banco. Por isso o cleanup achou 0 linhas: a persistência está correta.
- `src/routes/_authenticated/chat.$contractId.tsx:400-413` — a UI renderiza um "pill" de status do tool-call com base **apenas no estado** (`output-available`), ignorando se o `output` contém `{ error }`. O mapa `TOOL_LABELS.upsert_cliente.done = "Cliente salvo"` é mostrado mesmo quando o tool retornou erro. Resultado visto na auditoria: pill verde "Cliente salvo" → texto do assistente "CPF inválido".
- `src/routes/api/chat.tsx:72-88` — a tool `buscar_cliente` **não filtra por `user_id`**. Como RLS já restringe leitura ao dono (confirmado em C2), na prática não vaza dados, mas o comportamento "cadastro já existente" no reenviar provavelmente vem de um `buscar_cliente` chamado pelo modelo que casou por nome/doc em registro do próprio usuário criado em tentativa anterior — não é bug de validação, é comportamento esperado de "já achei esse cliente".

**Fix (escopo cirúrgico):**

1. `chat.$contractId.tsx` — `toolLabel(name, state, output)`: quando `state === "output-available"` e `output?.error` existir, renderizar label de erro (ex.: `"Falha: <error>"`) com estilo de aviso, em vez do `done` verde. Aplica a todos os tools, não só `upsert_cliente`.
2. `api/chat.tsx` — em `buscar_cliente`, adicionar `.eq("user_id", userId)` por defesa em profundidade (RLS já cobre, mas alinha com `upsertClient` da serverFn).

**Aceite:** com CPF `111.111.111-11` pelo chat, nenhum pill "Cliente salvo" aparece; o pill mostra "CPF inválido" e o texto do assistente confirma. Nenhuma `INSERT` ocorre (já é o caso hoje).

---

## D2 — Margem XLSX vs dashboard (DECISÃO PENDENTE, não aplicar ainda)

**O que `margin_cents` é hoje:**

`supabase/migrations/20260619184611_…sql:35-38` — coluna **GENERATED ALWAYS AS STORED**:

```
margin_cents = COALESCE(value_cents,0)
             - COALESCE(supplier_paid_amount_cents,0)
             - COALESCE(freight_paid_amount_cents,0)
```

- **Não é snapshot de 30%.** É margem realizada (receita − custo produto − custo frete), recalculada pelo Postgres a cada UPDATE das colunas-base.
- **Não congela na escrita** — coluna gerada stored: se você atualizar custos depois, `margin_cents` recalcula automaticamente. Mudar `defaultMarginPct` no perfil **não afeta** `margin_cents` (são coisas diferentes).
- **Campos de custo:** raramente preenchidos no fluxo atual — só são gravados quando o vendedor usa as tools `registrar_pagamento_fornecedor` / `registrar_frete`. Sem isso, `supplier_paid_amount_cents = NULL`, logo `margin_cents = value_cents` (margem = 100% da receita, claramente errado).

**Discordância concreta:**

- Dashboard (`financeiro.tsx:68-69, 178`): `monthRevenue * default_margin_pct / 100` → estimativa fixa em % da receita.
- XLSX (`financeiro.functions.ts:102`): `r.margin_cents / 100` → margem realizada (ou receita inteira quando custos zerados).

**Recomendação:** **Opção (c) — duas colunas no XLSX**, e dashboard ganha um segundo card "Margem realizada (mês)" só quando há linhas com custo informado. Razão: (a) esconde realidade quando o vendedor já registrou custos; (b) força refactor de dashboard que muitos usuários usam como expectativa rápida. (c) preserva os dois mundos e expõe a discrepância de forma explícita, sem invalidar contratos antigos.

**Aguardando seu OK** entre (a), (b) ou (c) antes de migrar/codar.

---

## C1 — Token do Autentique (OK, server-only)

- Lido em `src/lib/autentique.server.ts:22-24` via `process.env.AUTENTIQUE_API_TOKEN`. Arquivo `.server.ts` bloqueado do bundle do cliente.
- Consumidores (todos server-side): `src/lib/contracts.functions.ts:274` (envio) e `src/lib/profiles.functions.ts:137` (reorganizar). Secret confirmado em `SUPABASE_SECRETS` como `AUTENTIQUE_API_TOKEN`.
- Nenhuma referência ao token fora de `.server.ts`. ✅ Sem ação.

## C2 — RLS em clients/transactions (OK)

Verificado direto no Postgres:

```
clients       rowsecurity=t  4 policies (owner_select/insert/update/delete)
transactions  rowsecurity=t  4 policies (Users {select,insert,update,delete} own)
```

Ambas escopadas ao dono via `auth.uid() = user_id`. ✅ Sem ação. (Defesa adicional do `buscar_cliente` cai junto no fix D1.)

## C3 — "Reorganizar no Autentique" + pasta por cliente (RELATO, não aplicar)

**O que faz hoje** (`src/lib/profiles.functions.ts:134-148` + `src/lib/autentique.server.ts:34-90`):

1. Limpa `profiles.autentique_folder_id` no Supabase.
2. Chama `ensureTenantFolder` → cria **uma única pasta por tenant** na Autentique nomeada `"inTermo – <razão social|fantasia|owner|email>"` e salva o id no perfil.
3. Contratos antigos **não** são movidos; só os novos cairão na pasta nova. (O texto da UI já avisa isso.)

**É uma pasta por TENANT, não por cliente final.** Documentos do mesmo lojista compartilham a pasta.

**Viabilidade de "uma pasta por cliente":** sim, via API v2 (mesmas mutations já usadas — `createFolder` + `moveDocumentToFolder`). Esboço sem implementar:

1. Adicionar coluna `clients.autentique_folder_id text` (migration a confirmar).
2. Helper `ensureClientFolder(clientId)`: cria subpasta nomeada `"<nome do cliente> – <últimos 4 do doc>"` dentro da pasta do tenant (se a API aceitar `parent_id`; caso contrário, pasta no root da conta com prefixo do tenant).
3. Em `createDocumentInTenantFolder`, receber `folderId` do cliente em vez do tenant.
4. "Reorganizar" passa a iterar clientes do tenant e (opcional) re-mover documentos antigos via `moveDocumentToFolder`.

**Ponto de atenção:** `src/lib/autentique.server.ts` tem `TODO(autentique-schema)` admitindo que mutations `createFolder` / `moveDocumentToFolder` / suporte a `parent_id` precisam ser validados contra o schema real antes de produção. Sem essa confirmação não dá pra prometer hierarquia aninhada.

**Aguardando seu OK** para: (i) confirmar schema Autentique (probe real à API), (ii) migrar `clients` e implementar `ensureClientFolder`.

---

## Renomear "Assinatura inTermo" → "Plano/Cobrança" (sugestão sua, opcional)

Posso incluir junto com D1 num único PR pequeno se você confirmar. Senão fica fora.

---

## Resumo das ações pendentes da sua confirmação

| Item | Ação | Precisa OK? |
|---|---|---|
| D1 | Pill de tool-call respeita `output.error` + `eq user_id` em `buscar_cliente` | Não — fix óbvio, aplico ao aprovar o plano |
| D2 | Escolher (a)/(b)/(c) p/ margem | **Sim** |
| C1 | Nada | — |
| C2 | Nada | — |
| C3 | Probar schema Autentique + migrar `clients.autentique_folder_id` | **Sim** |
| Rename "Assinatura inTermo" | Sidebar/rota | **Sim** |
