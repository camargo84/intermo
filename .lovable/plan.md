## Sincronização e validação do commit `38171be`

O código do GitHub já está no projeto (commit `38171be` presente, ambas migrations `20260622000001_harden_signature_tokens_rls.sql` e `20260622000002_ensure_private_buckets.sql` em `supabase/migrations/`). Nada de código será alterado.

### Passos

1. **Aplicar as duas migrations de segurança no banco** (em uma única chamada de migration tool, exatamente o SQL versionado no GitHub — sem reescrever):
   - `REVOKE SELECT, UPDATE ON public.signature_tokens FROM anon;`
   - `DROP POLICY IF EXISTS "Anon read by token" / "Anon sign by token" ON public.signature_tokens;`
   - `UPDATE storage.buckets SET public = false WHERE id IN ('contract-pdfs','tenant-logos');`

2. **Rodar as duas consultas de verificação** e devolver o resultado bruto:
   - grants de `anon` em `signature_tokens` (esperado: vazio)
   - `id, public` dos buckets `contract-pdfs` e `tenant-logos` (esperado: `public = false` nos dois)

3. **Relatório final** com:
   - migrations aplicadas (timestamps)
   - resultado das duas queries
   - status: pronto para o usuário executar os testes manuais do passo 4 no preview (criar transação → link de assinatura → assinar white-label → PDF; WhatsApp no cliente; telas "transações"). Os testes manuais ficam com o usuário porque dependem de interação no preview — eu reporto qualquer erro que aparecer, sem corrigir código.

### Sem mudanças de código
Nenhum arquivo `.ts/.tsx/.sql` será criado ou editado. A única ação com efeito é aplicar as migrations já versionadas.