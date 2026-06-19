# Envio de contratos pra Autentique

Fluxo completo: criar contrato no banco → gerar PDF a partir de um template HTML → enviar pra Autentique via GraphQL → guardar `document_id` + status.

## 1. Banco — tabela `contracts`

Migration nova com RLS por `user_id`:

- `id` uuid pk
- `user_id` uuid (referência ao usuário autenticado)
- `title` text
- `content` text (corpo do contrato, markdown/HTML simples — vira PDF)
- `client_name` text, `client_email` text, `client_doc` text (CPF/CNPJ do signatário)
- `value_cents` integer null (valor da transação, opcional)
- `status` text default `'draft'` — valores: `draft`, `sent`, `signed`, `rejected`, `expired`, `error`
- `autentique_document_id` text null
- `autentique_signers` jsonb null (snapshot do retorno)
- `last_error` text null
- `sent_at`, `signed_at` timestamptz null
- `created_at`, `updated_at` timestamptz com trigger

RLS: `authenticated` só vê/edita os próprios (`auth.uid() = user_id`). GRANT pra `authenticated` e `service_role`, sem `anon`.

## 2. Geração do PDF (server-side)

- Lib: `@react-pdf/renderer` (puro JS, roda no Worker; sem `sharp`/`puppeteer`).
- Helper `src/lib/contracts.pdf.server.ts` exporta `renderContractPdf({ title, content, client, value })` → `Uint8Array`.
- Layout enxuto, usando os mesmos tokens visuais do app (sem cor hardcoded): cabeçalho com `title`, dados do contratante e do cliente, corpo (`content`) e linha de assinatura.

## 3. Server function `sendContractToAutentique`

Arquivo `src/lib/contracts.functions.ts`:

- `createServerFn({ method: 'POST' })`
- `.middleware([requireSupabaseAuth])`
- `.inputValidator(z.object({ contractId: z.string().uuid() }))`
- `.handler` faz, nessa ordem:
  1. Lê o contrato via `context.supabase` (RLS garante posse).
  2. Recusa se `status !== 'draft'` ou se já houver `autentique_document_id`.
  3. Gera o PDF com o helper acima.
  4. Monta um `FormData` no formato GraphQL multipart spec da Autentique:
     - `operations`: mutation `CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!)` chamando `createDocument(document:$document, signers:$signers, file:$file) { id name signatures { public_id name email action { name } link { short_link } } }`
     - `map`: `{ "0": ["variables.file"] }`
     - `0`: o PDF (`application/pdf`)
  5. `POST https://api.autentique.com.br/v2/graphql` com `Authorization: Bearer ${AUTENTIQUE_API_TOKEN}` (lido de `process.env` dentro do handler).
  6. Em sucesso: `update` no contrato → `status='sent'`, `autentique_document_id`, `autentique_signers`, `sent_at=now()`.
  7. Em erro HTTP/GraphQL: `status='error'`, `last_error` com a mensagem; lança erro pro cliente.

Retorna `{ documentId, signers: [{ name, email, link }] }`.

## 4. UI mínima pra disparar

Em `src/routes/_authenticated/contratos.novo.tsx` (hoje é stub): formulário com título, conteúdo (textarea), dados do cliente e valor. Submit cria a linha em `contracts` via uma segunda server function `createContract` (também protegida), depois chama `sendContractToAutentique`. Mostra toast com o link de assinatura retornado.

Em `contratos.index.tsx`: lista os contratos do usuário (server fn `listContracts`) com status e botão "abrir link de assinatura" quando `sent`.

## 5. Webhook de status (fora deste plano)

A Autentique manda callback quando o documento é assinado. Fica pra um próximo passo: rota pública `src/routes/api/public/autentique-webhook.ts` validando assinatura e atualizando `status`/`signed_at` via `supabaseAdmin`. **Não vou implementar agora** — só o envio.

## Detalhes técnicos

- Token: `process.env.AUTENTIQUE_API_TOKEN` (já configurado). Lido só dentro do `.handler()`.
- Endpoint: `https://api.autentique.com.br/v2/graphql`.
- Spec multipart: https://github.com/jaydenseric/graphql-multipart-request-spec (Autentique segue).
- Sem `supabaseAdmin` no fluxo — tudo via `requireSupabaseAuth` (RLS).
- Sem mudança de paleta, layout ou rotas existentes além das duas páginas de contratos.
- `@react-pdf/renderer` precisa ser instalado (`bun add @react-pdf/renderer`).

## Fora de escopo

- Webhook de retorno da Autentique.
- Templates múltiplos de contrato / editor rico.
- Reenvio, cancelamento, download do PDF assinado.
- Cobrança/integração com pagamento.
