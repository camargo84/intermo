## 1) GC de rascunhos — versão global p/ pg_cron

Hoje `garbageCollectMyDrafts` exige sessão (`requireSupabaseAuth`) e filtra `user_id = auth.uid()` — não roda em cron. Além disso, o critério atual usa `updated_at` + heurística em `client_name` (`""`, `—`, `-`), o que diverge do que você pediu.

### Plano

a. **Não usar HTTP/cron chamando server fn.** O endpoint exigiria autenticação ou um secret novo. Mais simples e auditável: agendar **SQL puro** via `pg_cron` chamando uma função SQL `SECURITY DEFINER`, sem rede.

b. **Criar `public.gc_orphan_drafts(_dry_run boolean default true)`** (via migration), `SECURITY DEFINER`, `search_path = public`, retornando `bigint` (linhas afetadas/contadas). WHERE final travado:

```sql
WHERE status = 'draft'
  AND client_id IS NULL
  AND pdf_path IS NULL
  AND created_at < (now() - interval '30 days')
```

- `_dry_run = true` (default) → roda `SELECT count(*)` com esse WHERE e retorna o número. **Não apaga nada.**
- `_dry_run = false` → `DELETE ... WHERE <mesmo WHERE>` e retorna `ROW_COUNT`.
- Grants: `REVOKE ALL ... FROM PUBLIC, anon, authenticated;` (só `postgres`/`service_role` executam). Sem exposição via PostgREST.

c. **Atualizar `garbageCollectMyDrafts` (server fn do usuário)** para usar o mesmo WHERE canônico (`client_id IS NULL` + `pdf_path IS NULL` + `status='draft'` + `created_at < now()-30d`), removendo a heurística de `client_name`. Mantém escopo `user_id = auth.uid()` (é o GC manual do próprio usuário). Assim os dois caminhos compartilham o critério.

d. **Primeira execução = dry-run obrigatório.** Antes de qualquer agendamento de DELETE, eu rodo:

```sql
SELECT public.gc_orphan_drafts(true) AS would_delete;
-- e um detalhamento auxiliar:
SELECT count(*) FILTER (WHERE created_at < now() - interval '30 days') AS antigos,
       count(*) AS draft_sem_cliente_sem_pdf
  FROM public.transactions
 WHERE status = 'draft' AND client_id IS NULL AND pdf_path IS NULL;
```

Reporto o número exato pra você. **Só depois** agendamos o DELETE.

e. **Schedule em America/Sao_Paulo.** `pg_cron` interpreta a expressão no TZ do cluster (UTC no Supabase). Pra rodar **diariamente às 04:00 BRT** = **07:00 UTC**:

```sql
SELECT cron.schedule(
  'gc-orphan-drafts-daily',
  '0 7 * * *',                              -- 04:00 America/Sao_Paulo
  $$ SELECT public.gc_orphan_drafts(false); $$
);
```

(Documentado no SQL como "04:00 BRT = 07:00 UTC, BRT sem DST desde 2019".)

f. **Sequência de execução (gates):**
   1. Migration cria `gc_orphan_drafts` + atualiza `garbageCollectMyDrafts`.
   2. Eu rodo o dry-run e te mostro a contagem.
   3. Você confirma → eu agendo o cron com `_dry_run=false`.

## 2) `/transacoes/novo` — unificar com o fluxo do chat

Hoje a rota usa `createContract` (`src/lib/contracts.functions.ts`), que tem schema **divergente** do agente (`criarContrato` em `src/lib/agent.functions.ts`):

| Campo | `/transacoes/novo` (createContract) | Chat (`criarContrato`) |
| --- | --- | --- |
| Cliente | string livre (`clientName`, `clientEmail`) | `client_id` (FK p/ `clients`, valida posse) |
| CPF/CNPJ | `clientDoc` string até 40, **sem validação** | normalizado/validado em `clients.functions.ts` |
| Valor | `valueCents` opcional | `valor_cents` obrigatório + regra `misto` |
| Produtos/forma_pagamento | inexistente | obrigatório |
| Telefone/CEP/UF | inexistente | normalizado em `upsertClient` |
| Conteúdo | textarea livre | montado a partir de `produtos` + snapshot do tenant |

São fluxos com regras diferentes. Manter os dois é exatamente o que você não quer.

### Plano

**Refazer `/transacoes/novo` como formulário "manual" que reaproveita as MESMAS server fns do chat**, sem schema próprio:

- Cliente: `<ClientPicker>` que chama `searchClients` / `upsertClient` (mesma normalização CPF/CNPJ/CEP/telefone/UF maiúscula, mesmos `validateCPF`/`validateCNPJ` de `src/lib/validators.ts`).
- Produtos: lista `{descricao, quantidade}` (mesmo shape de `criarContrato`).
- Valor: parser BRL → cents central (extraído pra `src/lib/format.ts` se ainda não estiver, e usado também pelo chat) → entrega `valor_cents` inteiro.
- Forma de pagamento: select `pix|boleto|cartao|misto` com `entrada_cents` quando `misto` (mesma validação que o agente).
- Submit chama **`criarContrato`** + **`gerarPdfContrato`** + **`sendContractToAutentique`** — mesmas fns que o chat usa.
- **Remover** `createContract` (a server fn divergente) ou marcá-la `@deprecated` e migrar `chat.$contractId` / qualquer outro chamador. Confirmo zero referências antes de remover.

Resultado: um único schema canônico (`agent.functions.ts` + `clients.functions.ts` + `validators.ts`). `/transacoes/novo` vira só uma UI alternativa do mesmo motor.

## Detalhes técnicos

- Migration nova: `gc_orphan_drafts(boolean)` SECURITY DEFINER + revogação de grants. Sem alterar tabela.
- Edit em `src/lib/gc.functions.ts`: WHERE canônico; remover heurística `client_name`.
- Edit em `src/routes/_authenticated/transacoes.novo.tsx`: trocar form/handlers para usar `criarContrato`/`gerarPdfContrato`/`sendContractToAutentique`.
- Edit em `src/lib/contracts.functions.ts`: remover `createContract` (ou `@deprecated` + throw) após varredura `rg "createContract\\b"`.
- Cron agendado via `supabase--insert` (não migration) só **após** o dry-run aprovado por você.

## Perguntas antes de eu codar

1. **Horário do cron**: 04:00 BRT (07:00 UTC) está bom, ou prefere outro?
2. **`/transacoes/novo` ainda faz sentido como UI** ou prefere remover de vez e deixar só o chat? (Eu recomendo manter como "modo avançado" unificado — mas é decisão sua.)
