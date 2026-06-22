# Rollback scripts (aplicação MANUAL)

Estes arquivos **não são migrations** e **não podem** ficar em `supabase/migrations/`.

## Por quê

O Supabase é *forward-only*: ele não tem convenção `.up.sql`/`.down.sql`. O
`supabase db push` varre `migrations/` e aplica como migration **todo arquivo
com prefixo de timestamp terminando em `.sql`** — o sufixo `.down` no meio do
nome é só texto, não é interpretado como rollback. Um `*.down.sql` dentro de
`migrations/` é, na prática, uma migration extra que roda no próximo `push`.

No caso do hardening de `signature_tokens`, o "rollback" contém exatamente o
`GRANT ... TO anon` + as policies anon que a correção de segurança removeu. Se
ele tivesse ficado em `migrations/`, o próximo `db push` reabriria o vazamento
(ou quebraria por versão duplicada, já que dividia o prefixo `20260622000001`
com a migration forward).

Por isso ele vive aqui, fora do alcance do `db push`, com extensão
`.rollback.sql` para nunca casar com o padrão de migration.

## Como aplicar (decisão consciente, não automática)

```bash
# revise o conteúdo antes
psql "$SUPABASE_DB_URL" -f supabase/rollback/<arquivo>.rollback.sql
```

## Scripts

- `harden_signature_tokens_rls.rollback.sql` — **PERIGOSO**: reabre o acesso
  `anon` à tabela `signature_tokens` (SELECT/UPDATE em todos os tokens de todos
  os tenants). Só use se a correção `20260622000001_harden_signature_tokens_rls`
  quebrar algo inesperado e você precisar voltar ao estado anterior enquanto
  investiga. O fluxo público de assinatura roda via `service_role` (bypass de
  RLS), então em condições normais `anon` não precisa de privilégio nenhum aqui.
