# Plano travado — Whitelabel + Autentique como cofre (opção B)

Decisão: o cliente assina no nosso domínio; ao fechar, empurramos o pacote de evidências pra Autentique como arquivo morto/custódia.

## 1. Whitelabel real na página de assinatura
**Arquivos:** `src/routes/api/public/sign.$token.tsx`, `src/routes/assinar.$token.tsx`

- GET retorna também: `tenant_logo_url` (signed URL 1h do bucket `tenant-logos` se existir `profiles.company_logo_path`) e `tenant_name` (fantasia → legal → owner).
- Header da página whitelabel passa a renderizar `<img src={tenant_logo_url}>` + nome fantasia. Fallback pro `<Logo />` do inTermo só quando o tenant não tem logo nem nome.
- Rodapé discreto: "Assinatura segura por inTermo" (mantém nossa identidade sem competir com a marca do lojista).

## 2. Fluxo de assinatura do lojista
**Arquivos:** `src/routes/_authenticated/transacoes.$contractId.tsx`, `src/routes/assinar.$token.tsx`, `src/lib/signature.functions.ts`

- Botão "Assinar como lojista" na tela do contrato quando `status='sent'` e o token do lojista ainda não foi assinado.
- Chama `createSignatureToken({ contractId, signerRole: 'lojista' })` e abre `/assinar/$token` em nova aba.
- Na página whitelabel: quando `signer_role='lojista'`, copy muda pra "Você está assinando como lojista" e os dados exibidos são "Cliente: X / Lojista: você".
- Contrato só vai pra `status='signed'` quando **ambos** os tokens (lojista + cliente) tiverem `signed_at`. Hoje só temos token de cliente; passamos a emitir os dois.

## 3. Custódia Autentique pós-assinatura (opção B)
**Arquivo novo:** `src/lib/autentique-custody.server.ts`
**Edita:** `src/routes/api/public/sign.$token.tsx` (POST)

Quando o **último** token pendente for assinado (fechando o contrato bilateralmente):
1. Compor um "PDF de evidências": original + página final com nome, IP, user-agent, timestamp UTC, hash SHA-256 do PDF original e imagem PNG das duas assinaturas embutidas. Usa o mesmo `pdf-lib` do `contracts.pdf.server.ts`.
2. Subir esse PDF na Autentique via `createDocument` com **um único signatário**: o lojista, com `action: "SIGN"` mas marcado como `external_signature: true` se o schema permitir; caso contrário, usar a conta do tenant Autentique como signatário-arquivo (a Autentique não tem endpoint público pra "marcar signatário externo como já-assinado", então tratamos o doc como prova arquivada).
3. Mover pra pasta do tenant (reusa `moveDocumentToFolder`).
4. Atualizar `transactions`: `autentique_custody_document_id`, `status='signed'`, `signed_at=now()`.
5. Gravar `contract_events: 'custody_archived'`.

Falha no passo Autentique **não** invalida a assinatura whitelabel — gravamos `contract_events: 'custody_failed'` e seguimos. A prova jurídica primária continua sendo a `signature_tokens` + auditoria local (MP 2.200-2).

## 4. Validação do schema Autentique (folders)
**Arquivo:** `src/lib/autentique.server.ts`

- Fetch da doc oficial (https://docs.autentique.com.br/api/mutations/) pra confirmar `createFolder` e `moveDocumentToFolder`. Se o schema real divergir, corrijo as mutations. Se a API não expõe pastas via GraphQL, removo a feature e deixo TODO claro.

## Migration necessária
Coluna nova `transactions.autentique_custody_document_id text null` (separada do `autentique_document_id` original pra não sobrescrever caso o fluxo (A) tenha sido usado antes). Grants já existem na tabela.

## Travamento do chat (evita duplicação)
**Arquivo:** `src/routes/api/chat.tsx`

- Remover a tool `enviar_para_assinatura` (fluxo A vira morto).
- Manter `gerar_link_assinatura` e `gerar_link_whatsapp`.
- Adicionar `gerar_link_assinatura_lojista` pro vendedor pedir o link da própria assinatura.
- Prompt do agente atualizado: o fluxo correto é gerar PDF → gerar link do lojista (assina) → gerar link/wa.me do cliente.

## O que NÃO muda
- Webhook Autentique (`/api/public/autentique-webhook`) continua de pé pra capturar eventos do documento de custódia.
- Template do contrato (já corrigido na rodada anterior).
- Bucket `contract-pdfs` (custody PDF vai no mesmo bucket sob `custody/<contract_id>.pdf`).

## Ordem de execução
1. Migration (coluna `autentique_custody_document_id`).
2. Whitelabel logo (gap 1).
3. Fluxo lojista (gap 2) + emissão automática dos dois tokens.
4. Custódia Autentique (gap 3) + arquivo novo `autentique-custody.server.ts`.
5. Validar folders + ajustar `autentique.server.ts`.
6. Limpar chat tools (evita fluxo A duplicado).
