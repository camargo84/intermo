
## Execução aprovada — ordem fixa

### Passo 1 — Migração A–E (uma migration só)

**A. `profiles`** — adicionar colunas:
- `logo_path text`, `company_address text`, `company_city text`, `company_uf text`, `company_cep text`
- `representative_name text`, `representative_cpf text`, `representative_qualification text`, `comarca text`

**B. `clients`** (nova) — `id`, `user_id` (FK auth.users), `name`, `cpf`, `rg`, `nacionalidade`, `estado_civil`, `data_nascimento`, `cep`, `endereco`, `complemento`, `bairro`, `cidade`, `uf`, `email`, `phone`, `is_pj`, `cnpj`, `created_at`, `updated_at`. Constraint `clients_doc_present` (cpf OR cnpj). Índice único `(user_id, cpf)` parcial e `(user_id, cnpj)` parcial. GRANTs (`authenticated`, `service_role`), RLS `auth.uid() = user_id`, trigger `update_updated_at_column`.

**C. `contracts`** — adicionar `client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL`, `produtos jsonb DEFAULT '[]'::jsonb`, `forma_pagamento text CHECK IN ('avista','parcelado','misto')`, `entrada_cents integer DEFAULT 0 CHECK (entrada_cents >= 0)`, `pdf_path text`, `tenant_snapshot jsonb`. Constraint `contracts_misto_coerente`: `forma_pagamento <> 'misto' OR (entrada_cents > 0 AND entrada_cents < value_cents)`. **Reutiliza `value_cents` existente — sem coluna nova.**

**D. `chat_threads`** (nova) — `id`, `contract_id` (FK contracts ON DELETE CASCADE, UNIQUE), `user_id`, `messages jsonb DEFAULT '[]'::jsonb`, `created_at`, `updated_at`. GRANTs, RLS `auth.uid() = user_id`, trigger updated_at.

**E. Anti-abuso quota** — `UPDATE subscriptions SET monthly_contract_quota = 2000 WHERE monthly_contract_quota = 200; ALTER TABLE subscriptions ALTER COLUMN monthly_contract_quota SET DEFAULT 2000;`

### Passo 2 — Criar buckets privados (tool, não-SQL)

- `supabase--storage_create_bucket(name='tenant-logos', public=false)`
- `supabase--storage_create_bucket(name='contract-pdfs', public=false)`

### Passo 3 — Migração F.2 (policies storage.objects)

Conforme já mostrado: `tenant_logos_owner_select/insert/update/delete` (prefixo `{user_id}/`) e `contract_pdfs_owner_select` apenas (sem INSERT/UPDATE/DELETE para authenticated — escrita só via service_role).

### Passo 4 — Implementação de código

- `src/lib/validators.ts` — `validateCNPJ`, `numeroPorExtenso(cents)`, `lookupCEP(cep)` (server fn ViaCEP)
- `src/lib/agent.functions.ts` — `buscarCliente`, `upsertCliente`, `criarContrato` (valida `misto`, monta `tenant_snapshot` sem CPF de cliente, retorna erro genérico se quota excedida), `gerarPdfContrato`
- `src/lib/contract-pdf.server.ts` — substitui gerador atual: A4, header com logo (download do bucket privado via `supabaseAdmin`), 9 cláusulas do molde, rodapé "Página X de Y", cita MP nº 2.200-2/2001
- `src/lib/profile.functions.ts` — `uploadLogo`, `getTenantLogoSignedUrl` (10 min), update dos novos campos do tenant
- `src/lib/chat.functions.ts` — `getChatThread`, `saveChatThread`, `getOrCreateThreadForContract`
- `src/routes/api/chat.ts` — `streamText` Gemini 3 Flash, system prompt injeta tenant, 4 tools, `stopWhen: stepCountIs(50)`, persiste em `chat_threads`
- `src/routes/_authenticated/chat.index.tsx` — cria contrato draft + thread, navega
- `src/routes/_authenticated/chat.$contractId.tsx` — UI do chat com AI Elements, botão "Baixar PDF" quando contrato pronto
- `src/components/shell/AppSidebar.tsx` — item "Chat com IA"
- `src/routes/_authenticated/configuracoes.tsx` — upload de logo + campos de endereço + representante + comarca (sem exibir limite mensal)
- `src/routes/termos.tsx` — R$119/mês ilimitado + cláusula anti-abuso (bots, compartilhamento de acesso, sessões simultâneas, rate-limit); bump `TERMS_VERSION` em `src/lib/terms.ts`

### Passo 5 — Entrega ao usuário

Mensagem final listando o que ficou pronto + roteiro de teste ponta a ponta:
1. Ir em `/configuracoes` → preencher endereço, representante, comarca, comarca, fazer upload do logo.
2. Abrir `/chat` → digitar "Quero vender um iPhone 15 Pro 256GB para Fulano, CPF 123…, por R$ 9.000 à vista".
3. Agente pergunta dados faltantes (RG, endereço via CEP, e-mail).
4. Agente chama `upsertCliente` → cria cliente.
5. Agente chama `criarContrato` → preenche contrato + monta `tenant_snapshot`.
6. Agente chama `gerarPdfContrato` → devolve signed URL.
7. Clicar "Baixar PDF" → abrir e conferir: logo no topo direito, 9 cláusulas, paginação no rodapé direito, valor por extenso, comarca correta.
8. Reload da página `/chat/{id}` → conversa persiste.
9. Voltar em `/contratos` → contrato aparece na lista.
