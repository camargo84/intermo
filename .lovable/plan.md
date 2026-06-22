# Reformular fluxo: Transação ponta-a-ponta + Assinatura white-label + Export NFS

## Visão geral

Hoje o app gira em torno de "Contrato". Vamos transformar isso em **Transação** — onde o contrato é só a primeira etapa de um ciclo que inclui pagamento do cliente, pagamento do fornecedor, frete e consolidação da margem. Cada transação terá ações claras (gerar contrato, enviar pelo WhatsApp, registrar pagamentos, consolidar) e alimentará a planilha mensal de NFS no mesmo formato que o contador já recebe hoje.

A assinatura digital ficará **híbrida**: o cliente e o lojista assinam numa página totalmente nossa (`/assinar/:token`), com o mesmo visual coral/mint/abyss do app. Por baixo, o Autentique continua sendo disparado em paralelo para manter a validade jurídica registrada lá também — sem o cliente nunca ver o site do Autentique. Cada lojista (tenant) tem uma **pasta própria no Autentique** para não misturar documentos entre clientes.

---

## Etapa 1 — Limpeza do fluxo de entrada

**Página inicial do chat (`/chat`)**:

- Remover os três cards de starter atuais.
- Manter só o hero ("Da conversa ao contrato, sem fricção") e a caixa de texto livre.
- Botão "Começar" vira **"Nova transação"**.

**Página "Nova transação"** (substitui `/contratos/novo` e a entrada do chat):

- Mesma tela unificada.
- Um único starter abaixo do campo: **"Gerar contrato"** — a IA inicia o ritual de coleta (cliente, produto, valores, frete).

**Sidebar / menu**:

- "Contratos" → **"Transações"**.
- "Novo contrato" → **"Nova transação"**.
- Rotas antigas (`/contratos*`) redirecionam 301 para `/transacoes*`.

---

## Etapa 2 — Renomear Contrato → Transação

- `contracts` → `transactions` (com view de compatibilidade por 1 release).
- Coluna `pdf_path` mantida (PDF do contrato é uma etapa da transação).
- Quota mensal passa a contar **transações**. Função `current_month_contract_count()` → `current_month_transaction_count()`.
- UI: "Transação" para o registro inteiro; "Contrato" continua existindo como nome do artefato PDF dentro dela.

---

## Etapa 3 — Etapas financeiras da transação

Novas colunas em `transactions`:

- `client_paid_amount`, `client_paid_at`, `client_payment_method`
- `supplier_paid_amount`, `supplier_paid_at`, `supplier_name`, `supplier_doc`
- `freight_paid_amount`, `freight_paid_at`, `freight_carrier`
- `consolidated_at`, `consolidated` (boolean)
- `margin_calculated` (gerada: remuneração − custo − frete)
- `tax_estimated` (gerada: 6% sobre margem)

**Fluxo na conversa**:

- Depois do contrato assinado, a IA cobra essas infos na ordem que o lojista quiser informar.
- Cada resposta atualiza o campo e o **mini checklist visual** no topo do chat: ✓ Contrato assinado · ○ Pagto cliente · ○ Pagto fornecedor · ○ Frete.
- Quando tudo preenchido, aparece o botão **"Consolidar transação"** (coral sólido) que seta `consolidated_at` e move a transação para o estado final — entra na planilha de NFS do mês.

---

## Etapa 4 — Plataforma de assinatura white-label (híbrido com Autentique)

**Página `/assinar/:token`** (pública, sem autenticação):

- Mesmo visual do app (header inTermo, fundo abyss, serif coral nos títulos).
- Mostra dados da transação: lojista, cliente, produto, valor.
- Preview do PDF do contrato (iframe).
- Campo de assinatura: desenhar com dedo/mouse **ou** digitar nome completo.
- Checkbox "Concordo em assinar eletronicamente este contrato" (necessário para validade MP 2.200-2).
- Botão "Assinar agora" registra: nome, IP, user-agent, timestamp, hash do PDF, imagem da assinatura.
- Tela de confirmação.

**Por baixo (invisível ao usuário)**:

- Quando o lojista gera o contrato, disparamos `POST createDocument` para Autentique em paralelo, **dentro da pasta do tenant** (ver Etapa 4b).
- Quando o signatário assina na nossa página, replicamos a assinatura para o Autentique via API (mesmo CPF/email).
- Quando todos assinaram em ambos os lados, o webhook do Autentique chega, baixamos o PDF assinado (lógica já existe) e ele vira o `signed_pdf_path` oficial.
- Se o Autentique falhar, a assinatura na nossa página continua válida — hash + metadados ficam suficientes para defesa autônoma.

**Tabela nova**: `signature_tokens` (token público, transaction_id, signer_role: lojista|cliente, signed_at, ip, user_agent, signature_image_path, expires_at — TTL 30 dias).

### Etapa 4b — Pasta Autentique por tenant (novo)

A API do Autentique suporta `createFolder`, `moveDocumentToFolder` e pastas compartilhadas com a organização (mutations `criando-pastas`, `movendo-documento-para-pasta`). Documentos criados via API aparecem normalmente no painel.autentique.com.br.

- Nova coluna `profiles.autentique_folder_id` (text, nullable).
- Na primeira vez que um lojista gera um contrato, criamos a pasta com nome `inTermo – <razão social>` (ou nome fantasia) via mutation `createFolder` e gravamos o ID em `profiles.autentique_folder_id`.
- Toda criação de documento subsequente usa esse `folder_id` no `createDocument` (ou `moveDocumentToFolder` logo após, dependendo do que a API aceitar — checamos no momento da implementação).
- Botão "Reorganizar no Autentique" nas Configurações para o caso raro do lojista renomear a empresa ou querer recriar a pasta.
- Resultado: quando o lojista abre `autentique.com.br`, vê **uma pasta limpa só com os documentos dele**, sem misturar com outros tenants do SaaS.

---

## Etapa 5 — Botão WhatsApp para o cliente

Quando o contrato é gerado, junto do card "Contrato gerado" no chat aparece **"Enviar para o cliente via WhatsApp"** que:

- Gera `https://wa.me/55<telefone>?text=<mensagem>` URL-encoded.
- Mensagem: _"Olá <nome>, seu contrato da inTermo está pronto! Para assinar, é só clicar aqui: <link /assinar/:token>. Qualquer dúvida, é só chamar."_
- Abre WhatsApp Web/app do lojista com a mensagem pronta.

Disponível também na página da transação para reenvio. Só aparece se o cliente tem telefone cadastrado.

---

## Etapa 6 — Página `/financeiro` com export XLSX no modelo da planilha

A página Financeiro recebe:

- Listagem das transações **consolidadas**, agrupadas por mês.
- Linha de **total da margem** e **imposto estimado (6%)** por mês.
- Botão **"Exportar planilha do mês"** ao lado de cada mês.

**Export XLSX idêntico ao modelo** (`NFS-VENTO-NORTE-MAIO-2026.xlsx`):

- Aba `DE 01-MM-AAAA A 31-MM-AAAA`, colunas: CPF, NOME DO CLIENTE, ENDEREÇO, PRODUTO, VALOR DA REMUNERAÇÃO, CUSTO, CUSTO FRETE, VALOR NFS (MARGEM), DESCRIÇÃO DO SERVIÇO, DATA PARA EMISSÃO.
- DESCRIÇÃO DO SERVIÇO gerada automaticamente no mesmo formato multilinha.
- Linha final com **TOTAL MARGEM (BASE NFS)** e **IMPOSTO ESTIMADO – DAS Simples Nacional (6%)**.
- Formatação moeda BR + datas, fonte Arial.

---

## Detalhes técnicos

**Stack**: TanStack Start + Supabase + Autentique GraphQL + AI SDK + Lovable AI Gateway.

**Migração de banco** (uma migration):

1. `ALTER TABLE contracts RENAME TO transactions` + VIEW de compatibilidade.
2. ADD COLUMNs financeiros da Etapa 3.
3. CREATE TABLE `signature_tokens` (RLS: service_role full, anon select por token).
4. ADD COLUMN `profiles.autentique_folder_id`.
5. Renomear função `current_month_contract_count` → `current_month_transaction_count`.

**Novos server functions** (`src/lib/transactions.functions.ts`):

- `getTransactionPipeline(id)`, `recordClientPayment`, `recordSupplierPayment`, `recordFreightPayment`, `consolidateTransaction(id)`.
- `exportMonthlyNfs(year, month)` usando `exceljs` (puro JS, compatível com Cloudflare Workers).

**Novo helper Autentique** (`src/lib/autentique.server.ts`):

- `ensureTenantFolder(userId)` — lazy-creates pasta e cacheia em `profiles.autentique_folder_id`.
- `createDocumentInTenantFolder(...)`.

**Nova rota pública** (`src/routes/assinar/$token.tsx` + `src/routes/api/public/sign.$token.tsx`).

**Edge runtime**: `exceljs` (puro JS). Não usar `xlsx-populate`/`node-xlsx`.

**Ordem de implementação** (commits separados):

1. Migration: rename + colunas + signature_tokens + autentique_folder_id.
2. UI: remover starters, renomear menu, rotas/redirects.
3. Helper Autentique com pasta por tenant + ajuste no fluxo atual de criação.
4. Página `/assinar/:token` + token + replicação Autentique invisível.
5. Botão WhatsApp no chat e na página da transação.
6. Conversa com etapas financeiras + checklist + botão consolidar.
7. Página `/financeiro` + export XLSX.

---

## Fora de escopo (próxima rodada)

- Envio automático mensal da planilha por e-mail ao contador.
- Aba "USO INTERNO – SEM NFS" no export.
- Edição/cancelamento de transação consolidada (read-only depois de consolidada).
- Notificações push/e-mail quando o cliente assina.

---

## Riscos e cuidados

- **Migração `contracts → transactions`** é grande; view de compatibilidade reduz risco. Migration vai em chamada separada para sua aprovação antes do código.
- **Validade jurídica** da assinatura própria (MP 2.200-2): checkbox de consentimento + Autentique em paralelo cobre cenários de contestação.
- **Telefone do cliente**: botão WhatsApp só aparece quando cadastrado.
- **Pasta Autentique**: se a API rejeitar `folder_id` no `createDocument`, fazemos `moveDocumentToFolder` logo depois — fluxo robusto a ambas as formas. Pastas já existentes manualmente no painel do lojista não são tocadas; criamos uma nova chamada "inTermo – <empresa>".
- **Token de assinatura**: TTL 30 dias, revogável manualmente pelo lojista.
