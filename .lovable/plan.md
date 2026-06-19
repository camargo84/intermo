## Corrigir: SECURITY DEFINER executável por usuários não autenticados

O scanner detectou funções `SECURITY DEFINER` no schema `public` que podem ser chamadas sem login. Essas funções rodam com privilégios elevados, então expô-las a `anon` é risco de escalada.

### Funções afetadas
Todas as funções SECURITY DEFINER do projeto:
- `public.has_role(uuid, app_role)` — usada em policies RLS, chamada com `auth.uid()` (precisa de usuário autenticado)
- `public.current_month_contract_count()` — usa `auth.uid()`, sem sentido para anônimo
- `public.has_active_subscription(uuid)` — checagem de assinatura, sem sentido para anônimo
- `public.handle_new_user()` — trigger de `auth.users`, nunca deve ser chamada via API

### Correção (migration SQL)

Revogar `EXECUTE` de `PUBLIC` e `anon` em todas elas; manter acesso para `authenticated` e `service_role` (onde aplicável). `handle_new_user` é trigger — revoga de tudo exceto `postgres`/`service_role`.

```sql
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.current_month_contract_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_month_contract_count() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
```

### Validação
- Rodar `supabase--linter` depois da migration
- Marcar finding como resolvido em `security--manage_security_finding`
- Nenhum código frontend muda — essas funções só são chamadas server-side ou dentro de policies/triggers

Sem impacto em fluxos existentes (login, contratos, assinatura): usuários autenticados continuam com acesso normal.