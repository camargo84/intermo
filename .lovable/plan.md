## Escopo

Três ajustes no chat — só comportamento/UI e normalização de input. Sem mudar schema do banco.

---

## 1. Quebras de linha preservadas na mensagem do usuário

**Problema:** colar texto do WhatsApp com vários `Enter` (visível no 2º print, a bolha verde inteira virou um parágrafão único) faz a mensagem ficar emendada.

**Causa:** em `src/routes/_authenticated/chat.$contractId.tsx`, o ramo `isUser` de `MessageBlock` renderiza `<div>{part.text}</div>` — o HTML colapsa `\n` em espaço.

**Correção:** trocar por `<div className="whitespace-pre-wrap break-words">…</div>`, mantendo o restante do estilo da bolha. ~2 linhas, só apresentação. O texto já chega íntegro no backend; é só visual.

---

## 2. Normalização de inputs do agente (data, CPF, CEP, telefone)

**Problema visto no print:** badge vermelho `Falha: date/time field value out of range: "25/11/1996"`. O usuário escreveu a data no formato brasileiro `DD/MM/YYYY` e o agente repassou cru para a coluna `DATE` do Postgres, que só aceita ISO `YYYY-MM-DD`. Mesma fragilidade existe para CPF/CNPJ/CEP/telefone quando vêm com pontuação ou sem.

**Correções (server-side, em `src/routes/api/chat.tsx` e `src/lib/clients.functions.ts`):**

- Criar `src/lib/normalize-input.ts` com:
  - `normalizeDateBR(input)` → aceita `DD/MM/YYYY`, `DD-MM-YYYY`, `YYYY-MM-DD`, `DD/MM/YY` (assume 19xx/20xx por janela), `Date` ISO; valida calendário (mês 1-12, dia válido para o mês, ano 1900-hoje); devolve `YYYY-MM-DD` ou `null` se vazio; lança `InputFormatError` com mensagem pt-BR se inválido.
  - `normalizeCEP(input)` → mantém só dígitos, valida 8 chars.
  - `normalizePhoneBR(input)` → mantém só dígitos, valida 10/11 chars.
  - (CPF/CNPJ já são normalizados via `onlyDigits` + validadores existentes — manter.)
- No `inputValidator`/handler de `upsert_cliente` (e em `clients.functions.ts → upsertClient`):
  - Passar `data_nascimento` por `normalizeDateBR` antes do INSERT/UPDATE.
  - Passar `cep` por `normalizeCEP`, `phone` por `normalizePhoneBR`.
  - Em falha de formato, retornar `{ ok: false, error_code: "INVALID_INPUT", field, message_pt }` em vez de deixar o erro do Postgres vazar.
- Reforçar no system prompt do agente que datas devem ser enviadas como `YYYY-MM-DD` (e que o normalizador aceita BR como fallback), eliminando a tendência de repassar o texto cru do usuário.

---

## 3. Tratamento amigável de erros do agente

**Problema visto no 1º print:** dois badges contraditórios — “Contrato gerado” (verde) + “Falha: Cannot read properties of null (reading 'company_address')” (vermelho em inglês). O agente criou o registro de contrato mesmo sem dados de perfil, e o `TypeError` cru de JS vazou para a UI. No 2º print, mesma classe de problema com o erro do Postgres aparecendo entre os badges “Cliente consultado” e “Cliente salvo”.

**Causas:**
- `gerar_pdf_contrato`/`renderContractPdf` acessam `profile.company_address` sem checar `null`.
- O agente está chamando `gerar_contrato` antes do `preflight_contrato` confirmar perfil completo (preflight existe mas não é obrigatório).
- O badge de ferramenta na UI imprime literalmente `output.error` sem tradução, sem agrupamento e sem distinguir erro recuperado de erro fatal.
- Quando o PDF falha após o INSERT, o registro fica órfão e ainda aparece “Contrato gerado”.

**Correções:**

1. **Server tools (`src/routes/api/chat.tsx`, `src/lib/agent.functions.ts`):**
   - `gerar_contrato` e `gerar_pdf_contrato`: rodar a mesma checagem do preflight no início. Faltando perfil/cliente, retornar `{ ok: false, error_code: "PROFILE_INCOMPLETE" | "CLIENT_INCOMPLETE", missing_fields, message_pt }` sem prosseguir. Nunca `throw`.
   - Envolver `renderContractPdf` + upload em `try/catch`. Em falha, **deletar a linha de `transactions` recém-criada** (rollback) e retornar `{ ok: false, error_code: "PDF_RENDER_FAILED" }`. Some o “Contrato gerado” fantasma.
   - Padronizar todos os retornos: `{ ok: true, ... }` ou `{ ok: false, error_code, message_pt, ...detalhes }`. Nunca expor `error.message` cru.

2. **`renderContractPdf` (`src/lib/contracts.pdf.server.ts`):** validar campos obrigatórios do `TenantSnapshot` no topo e lançar `ContractDataError` tipado (capturado pelo caller).

3. **System prompt do agente (`src/routes/api/chat.tsx`):**
   - Regra explícita: **sempre** chamar `preflight_contrato` antes de `gerar_contrato`. Se `missing_profile` não vazio → não chamar `gerar_contrato`, pedir para abrir Configurações, parar.
   - Recebendo `{ ok: false }` de qualquer tool: traduzir para uma única mensagem pt-BR clara e parar (sem retry automático em loop).

4. **UI do badge de ferramenta (`MessageBlock` em `chat.$contractId.tsx`):**
   - Mapa `error_code → label pt-BR`:
     - `PROFILE_INCOMPLETE` → “Faltam dados do seu perfil: {campos}” + botão **Abrir Configurações** (`<Link to="/configuracoes">`).
     - `CLIENT_INCOMPLETE` → “Faltam dados do cliente: {campos}”.
     - `INVALID_INPUT` → “{field}: {message_pt}”.
     - `PDF_RENDER_FAILED` → “Não foi possível gerar o PDF. Tente novamente.”
     - `RATE_LIMITED` → “Muitas tentativas, aguarde um instante.”
     - default → “Algo deu errado. Tente novamente.” (nunca stack/inglês).
   - **Agrupamento visual:** quando vários badges de tool aparecerem na mesma resposta (ex.: “Cliente consultado” + “Falha…” + “Cliente salvo”), agrupar em uma única linha compacta com separador, em vez de três chips empilhados disputando atenção. Erro fatal ao final → o sucesso anterior vira badge neutro (“Cancelado”). Erro recuperado (próxima tool teve sucesso) → o erro vira badge âmbar discreto (“Reententado”), não vermelho gritante.
   - Limite de 1 linha de altura para o conjunto de badges, com tooltip mostrando detalhes ao passar o mouse.

5. **Logs:** erro técnico só em `console.error` server-side (via `error-capture`), nunca no payload da tool retornado ao cliente.

---

## Arquivos afetados

- `src/routes/_authenticated/chat.$contractId.tsx` — `whitespace-pre-wrap` na bolha do usuário; mapa de erros, agrupamento dos chips e botão “Abrir Configurações” no badge de tool.
- `src/routes/api/chat.tsx` — normalização de data/CEP/telefone em `upsert_cliente`; guards de início + rollback em `gerar_contrato`/`gerar_pdf_contrato`; retornos padronizados `{ ok, error_code, ... }`; system prompt reforçando preflight e formato de data.
- `src/lib/agent.functions.ts` — mesmos guards e formato de retorno.
- `src/lib/clients.functions.ts` — `upsertClient` chamando os normalizadores; retornos padronizados.
- `src/lib/contracts.pdf.server.ts` — validação no topo de `renderContractPdf` lançando `ContractDataError` tipado.
- `src/lib/contract-requirements.ts` — utilitário único `assertProfileComplete`/`assertClientComplete` reutilizado pelas tools.
- `src/lib/normalize-input.ts` (novo) — `normalizeDateBR`, `normalizeCEP`, `normalizePhoneBR` + `InputFormatError`.

Sem migration, sem mudança em UI fora do chat, sem mudança no fluxo de auth/onboarding.