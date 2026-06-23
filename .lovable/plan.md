# Auditoria + plano de correção do fluxo do agente

## Achados da auditoria

Fiz a leitura do fluxo do chat (`src/routes/api/chat.tsx`), das funções já existentes em `src/lib/contracts.functions.ts`, `src/lib/signature.functions.ts`, `src/lib/autentique.server.ts` e da página whitelabel `src/routes/assinar.$token.tsx`. Os blocos do print mostram exatamente o que está faltando no agente — apesar das peças do back-end já existirem.

| # | Problema | Onde |
|---|---|---|
| 1 | Após `gerar_pdf_contrato`, o agente entrega só a URL temporária do PDF e encerra. Não envia para Autentique, não gera link whitelabel `/assinar/:token`, não monta link `wa.me`. | `src/routes/api/chat.tsx` (faltam tools), `BASE_SYSTEM_PROMPT` (fluxo termina no passo 6). |
| 2 | A página whitelabel `/assinar/:token` e o helper `createSignatureToken` já existem; a tela de Conversa já tem um botão `openWhatsapp()` que combina os dois. **Nada disso está disponível para o agente** dentro do chat. | `src/routes/_authenticated/chat.$contractId.tsx` linhas 198/217. |
| 3 | `sendContractToAutentique` server fn já existe e a página `/transacoes/:id` usa via botão. **Não há tool no chat** que dispare esse fluxo. | `src/lib/contracts.functions.ts` linha 52. |
| 4 | Mesmo com `active_client_id` no CONTEXTO, o modelo às vezes ignora a instrução e chama `upsert_cliente` sem `client_id` nem documento → retorno `INVALID_INPUT: Informe CPF ou CNPJ` (badge vermelho do print). | `src/routes/api/chat.tsx` `upsert_cliente.execute` linhas 217–226. |
| 5 | O bloco de CONTEXTO não expõe o **telefone do cliente em dígitos** (apenas marca como "preenchido"). Sem isso o agente não consegue propor o `wa.me` do cadastro. | `src/routes/api/chat.tsx` linhas 838–854. |
| 6 | Sem `TOOL_LABELS` para as novas ferramentas (`enviar_para_assinatura`, `gerar_link_assinatura`, `gerar_link_whatsapp`) os badges aparecem como "Processando…/Concluído". | `src/routes/_authenticated/chat.$contractId.tsx` linhas 399–405. |
| 7 | `friendlyErrorFromOutput` não trata códigos novos (`AUTENTIQUE_FAILED`, `ALREADY_SENT`, `MISSING_PHONE`). | mesmo arquivo, linhas 438–462. |

## Plano de correção

### 1. Novas tools do agente (`src/routes/api/chat.tsx`)

**`enviar_para_assinatura`**
- Input: `{ contract_id }`.
- Verifica ownership, exige `pdf_path`, status `draft` e `autentique_document_id` nulo.
- Reaproveita a lógica de `dispatchToAutentique` (extrair para `src/lib/autentique-dispatch.server.ts` para ser chamado tanto pela server fn pública quanto pela tool). Não duplica código.
- Retorna `{ ok, document_id, signers: [{ name, email, link }] }` ou `{ ok:false, error_code: "ALREADY_SENT" | "PDF_MISSING" | "AUTENTIQUE_FAILED", message_pt }`.

**`gerar_link_assinatura`** (whitelabel)
- Input: `{ contract_id }`.
- Chama mesma lógica do `createSignatureToken`. Retorna `{ ok, url }` com URL absoluta `${baseUrl}/assinar/<token>` (deriva `baseUrl` de `request.url` no handler — funciona em preview, prod e custom domain).

**`gerar_link_whatsapp`**
- Input: `{ contract_id, telefone?: string, mensagem?: string, incluir_link_assinatura?: boolean (default true) }`.
- Resolve telefone: usa `telefone` informado, senão `clients.phone` do cliente da transação (e o expõe ao agente — ver item 4).
- Normaliza para E.164 BR (`55XXXXXXXXXXX`).
- Se `incluir_link_assinatura`, chama internamente `createSignatureToken` para gerar o token e monta a mensagem padrão ("Olá <nome>, seu contrato está pronto. Para assinar: <url>").
- Retorna `{ ok, wa_url, phone_used, signature_url }` ou `{ ok:false, error_code: "MISSING_PHONE", message_pt }`.

### 2. Hardening de `upsert_cliente`

Antes de devolver `INVALID_INPUT: Informe CPF ou CNPJ`, se `input.client_id` não veio mas `body.contractId` existe e a transação tem `client_id`, usar esse `client_id` como `existingClient`. Isso evita o badge vermelho do print quando o modelo "esquece" de passar o `client_id`.

### 3. Atualizar o `BASE_SYSTEM_PROMPT`

Adicionar passos 7–8 explícitos:

> 7. Após `gerar_pdf_contrato` ok, NÃO encerre. Pergunte: "Posso enviar para assinatura agora?". Se sim, chame `enviar_para_assinatura` e mostre o link do signatário.
> 8. Em seguida ofereça gerar um link para WhatsApp. Pergunte: "Envio para o número cadastrado (<últimos 4 do CONTEXTO>) ou para outro número?". Com a resposta, chame `gerar_link_whatsapp` e devolva a URL `wa.me` clicável. Se o vendedor preferir só o link whitelabel, chame `gerar_link_assinatura`.

Também reforçar: "NUNCA peça CPF/CNPJ se `active_client_id` está no CONTEXTO — chame `upsert_cliente` com esse `client_id`."

### 4. Expor telefone no CONTEXTO

No bloco de CONTEXTO, quando o cliente está vinculado, adicionar:
- `cliente_phone_e164: 55XXXXXXXXXXX` (ou `(não informado)`).
- `cliente_phone_mascarado: ****-1234`.

Assim o modelo consegue propor "envio para o número terminado em 1234?" e passar o número ao `gerar_link_whatsapp`.

### 5. UI do chat (`src/routes/_authenticated/chat.$contractId.tsx`)

- Estender `TOOL_LABELS` com:
  - `enviar_para_assinatura`: "Enviando para Autentique…" / "Enviado para assinatura"
  - `gerar_link_assinatura`: "Gerando link de assinatura…" / "Link de assinatura pronto"
  - `gerar_link_whatsapp`: "Montando mensagem do WhatsApp…" / "Link do WhatsApp pronto"
  - `gerar_pdf_contrato`: "Gerando PDF…" / "PDF gerado" (faltava também).
- Estender `friendlyErrorFromOutput` com `ALREADY_SENT`, `AUTENTIQUE_FAILED`, `PDF_MISSING`, `MISSING_PHONE`.
- Garantir que URLs (PDF assinado, `/assinar/<token>`, `wa.me`) sejam renderizadas como **link clicável** pelo `ReactMarkdown` já em uso (validar `linkify` / autolink — se preciso, ativar `remark-gfm` que já existe nas dependências do template ou trocar o renderer de `a` para abrir em nova aba com `target="_blank" rel="noopener"`).

### 6. Refatoração mínima

Extrair a função privada `dispatchToAutentique` de `src/lib/contracts.functions.ts` para `src/lib/autentique-dispatch.server.ts`, recebendo `supabase: Supa` e `contract: ContractRow`. Tanto `sendContractToAutentique` quanto a nova tool `enviar_para_assinatura` importam de lá. Sem mudança de comportamento para a UI existente.

## Fora do escopo agora

- Reenvio para outros signatários, lembretes automáticos, edição do template da mensagem WhatsApp.
- Métricas de leitura/assinatura no chat (já existem em `/transacoes/:id`).
- Mudanças visuais — light/dark e tokens ficam como estão.

## Arquivos

- **Novo:** `src/lib/autentique-dispatch.server.ts`.
- **Editados:** `src/routes/api/chat.tsx` (3 tools novas, prompt, contexto, hardening do upsert), `src/lib/contracts.functions.ts` (passa a importar dispatch), `src/routes/_authenticated/chat.$contractId.tsx` (TOOL_LABELS + friendlyErrorFromOutput + target=_blank em links).