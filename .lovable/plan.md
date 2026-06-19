## Contexto

Hoje o login mostra uma ilustração estática (`AuthLayout.tsx > ChatPreviewMock`) com chrome de janela macOS, abertura serif itálico coral, bolha verde e um card "CONTRATO GERADO" inline. O chat real (`chat.$contractId.tsx`) **não** tem nada disso: o PDF aparece só como botão "Baixar PDF" no header.

A integração Autentique já existe parcialmente: `sendContractToAutentique` envia, e o webhook `/api/public/autentique-webhook/$` recebe eventos e marca `signed_at`. **O que falta:** baixar o PDF assinado do Autentique quando todos assinam e guardar em storage pra download. Não existe coluna pra isso.

## Fase A — Visual do chat (alinhar à ilustração)

Mexer só em `src/routes/_authenticated/chat.$contractId.tsx`:

1. **Abertura serif-itálico-coral**: pós-processar a primeira mensagem da IA — primeira "frase curta" (até a primeira `.`, `!` ou `?` dentro dos primeiros ~20 chars, ex.: "Boa tarde.", "Olá.", "Perfeito.") renderiza em `font-serif-display italic text-[color:var(--color-coral)]`, e o resto do parágrafo segue normal. Aplicado só no primeiro parágrafo, sem mexer no markdown subsequente.

2. **Bolha do usuário**: igualar à ilustração — `bg-[color:var(--color-signal-mint)] text-[color:var(--color-abyss)] rounded-2xl px-4 py-2`, máx 80% largura, alinhada à direita. (Hoje usa `bg-primary` que é parecido mas não idêntico.)

3. **Card inline "CONTRATO GERADO"**: novo componente `ContractFileCard` renderizado dentro da mensagem da IA quando `contract.pdf_path` existir e for a mensagem mais recente do assistente. Estilo da ilustração: borda sutil, label caps tracking-wide, nome do arquivo clicável que chama `getContractPdfSignedUrl`.

4. **Card inline "CONTRATO ASSINADO"**: mesmo componente, variante diferente, aparece quando `contract.signed_pdf_path` existir (Fase B). Antes da Fase B, fica oculto.

5. **Remover botão "Baixar PDF" do header** — toda a navegação do PDF vai pros cards inline (decisão do usuário).

6. **Chrome opcional**: NÃO replicar o semáforo macOS dentro da app real (ele faz sentido na ilustração de marketing, dentro do app vira ruído). Manter header limpo só com "Conversa" + subtitle.

## Fase B — Coluna `signed_pdf_path` + storage

Migração:
- `ALTER TABLE contracts ADD COLUMN signed_pdf_path text, ADD COLUMN signed_pdf_downloaded_at timestamptz`.
- Bucket `contract-pdfs` já existe e é privado — reusar. Caminho: `{user_id}/{contract_id}/signed.pdf`.

## Fase C — Download do PDF assinado via webhook

Editar `src/routes/api/public/autentique-webhook.$.tsx`:

- Quando o cálculo já marca `status = "signed"` (todos assinaram), disparar uma função interna `fetchAndStoreSignedPdf(documentId, contractId)`:
  1. Query GraphQL no Autentique pedindo `document(id: $id) { files { signed } }` — retorna URL temporária do PDF assinado.
  2. `fetch` na URL → ArrayBuffer.
  3. `supabaseAdmin.storage.from("contract-pdfs").upload(path, bytes, { contentType: "application/pdf", upsert: true })`.
  4. `UPDATE contracts SET signed_pdf_path = path, signed_pdf_downloaded_at = now()`.
  5. Log em `contract_events` ("Contrato assinado armazenado").
- Idempotente: se `signed_pdf_path` já existe, pula.
- Falha no download não derruba o webhook (loga `last_error`, retorna 200 pro Autentique não reenviar infinitamente — botão manual de retry vem depois se precisar).

Nova server fn `getSignedPdfSignedUrl(contract_id)` análoga a `getContractPdfSignedUrl`, gera signed URL do bucket privado.

## Fase D — Mensagem do agente quando assina

Quando o status muda pra `signed`, na próxima mensagem da IA na thread daquele contrato, ela já vai conseguir "ver" `signed_pdf_path` (via contexto do chat handler) e o card "CONTRATO ASSINADO" aparece naturalmente. Sem polling em tempo real nesta rodada — usuário recarrega/manda nova mensagem pra ver.

## Detalhes técnicos

- Autentique GraphQL `files.signed` retorna URL pública temporária (~15min). Baixar e re-hospedar é necessário pra link estável.
- `supabaseAdmin` importado com `await import()` dentro do handler do webhook (regra de import-graph).
- Card inline lê `contract.pdf_path` / `contract.signed_pdf_path` via query já existente `getChatThread` — adicionar esses campos ao retorno se ainda não tiver.
- Nenhuma mudança em `AuthLayout.tsx` (a ilustração já está como o usuário quer).

## Fora de escopo desta rodada

- Realtime/polling pra atualizar o card "ASSINADO" sem reload.
- Botão manual "rebaixar PDF assinado" caso o webhook falhe.
- Notificação por e-mail quando assina.
- Exclusão de contrato + cascata em lançamentos financeiros (já listado pra fase futura).
