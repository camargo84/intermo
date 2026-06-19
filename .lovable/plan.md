# Webhook da Autentique

## 1. Secret

- Adiciono `AUTENTIQUE_WEBHOOK_SECRET` via `add_secret` (vou pedir num passo separado, fora deste plano de código).
- Já fica documentado: a URL pra cadastrar no painel da Autentique é `https://project--{id}.lovable.app/api/public/autentique-webhook/{SECRET}`.

## 2. Rota — `src/routes/api/public/autentique-webhook.$.tsx`

Splat captura o secret como `_splat`. Bypass de auth porque está sob `/api/public/`. Handler:

1. `POST` apenas (outros métodos → 405). Sem CORS (caller é o servidor da Autentique, não browser).
2. Compara `params._splat` com `process.env.AUTENTIQUE_WEBHOOK_SECRET` usando `timingSafeEqual`. Mismatch → 401.
3. Lê JSON do body. A Autentique manda algo como:
   ```json
   {
     "event": { "type": "signature.accepted" | "document.signed" | "document.rejected" | "document.expired" | ... },
     "document": { "id": "...", "name": "...", "signed_count": 1, "signatures": [...] },
     "signature": { "public_id": "...", "name": "...", "email": "...", "signed_at": "...", "rejected_at": null }
   }
   ```
   Tolerante a variações: tenta `body.event?.type`, `body.event`, `body.type`.
4. Acha o contrato:
   ```ts
   supabaseAdmin.from('contracts').select('id,status,autentique_signers').eq('autentique_document_id', documentId).maybeSingle()
   ```
   Se não achar → 200 com `{ ignored: true }` (evita reentregas em loop).
5. Mapeia evento → patch:
   - `document.signed` / `signed` → `status='signed'`, `signed_at = signature.signed_at ?? now()`.
   - `document.rejected` / `rejected` → `status='rejected'`.
   - `document.expired` / `expired` → `status='expired'`.
   - `document.deleted` → `status='error'`, `last_error='Documento removido na Autentique'`.
   - `signature.accepted` / `signature.viewed` → não muda `status`, só atualiza o snapshot de signatários.
6. **Merge dos signatários** em `autentique_signers` (não sobrescreve cego): se o payload trouxer `document.signatures`, regrava com `{ name, email, link, signed_at, rejected_at }` de cada um. Caso contrário, faz patch no signer correspondente (`signature.public_id` ou email).
7. `supabaseAdmin.from('contracts').update(patch).eq('id', contract.id)`.
8. Sempre `200` (com JSON `{ ok: true }`) em caminhos válidos pra Autentique não ficar reentregando. Erros internos retornam 500 com JSON.
9. `supabaseAdmin` carregado dentro do handler com `await import('@/integrations/supabase/client.server')` (rota é client-reachable; nunca top-level).

## 3. Schema da tabela

Já cobre tudo: `status`, `signed_at`, `last_error`, `autentique_signers jsonb`. **Sem migration nova.**

## 4. Fora de escopo

- Reenvio / cancelamento / download do PDF assinado.
- UI mostrando linha do tempo de eventos (a lista já mostra status atual).
- Reconciliação por polling (fica como fallback futuro caso webhook falhe).
- Verificação de assinatura HMAC (a Autentique não fornece; o secret na URL é a barreira).

## Detalhes técnicos

- Endpoint: `POST /api/public/autentique-webhook/{SECRET}`.
- `timingSafeEqual` do `node:crypto` pra comparar o secret.
- Usa `supabaseAdmin` (service role) porque o webhook não tem sessão de usuário — RLS é bypass intencional aqui, mas o acesso é gateado pelo secret.
- Validação leve com Zod no envelope, mas tolerante (`.passthrough()`) porque a Autentique adiciona campos.
