# Terceira leva — plano

## D1 — fechar: match só por documento

**Achado (src/routes/api/chat.tsx:72–89, ferramenta `buscar_cliente`)**
- Linha 83: se `onlyDigits(query).length >= 11` → filtra por `cpf.eq` OR `cnpj.eq`. ✅
- Linha 84 (else): cai em `ilike("name", "%query%")`. ❌ É exatamente o cenário "dois João da Silva" que você quer evitar. A persistência (`upsert_cliente`, linhas 135–153) já é chaveada por CPF/CNPJ, então o risco real é o agente trazer um cliente errado pelo nome e o vendedor confirmar sem perceber.

**Fix proposto**
- Em `buscar_cliente`:
  - Trocar o input para deixar explícito: `z.object({ documento: z.string().min(11) })` (aceita CPF ou CNPJ; normaliza com `onlyDigits`).
  - Remover o branch de `ilike(name)`. Se vier sem 11+ dígitos válidos, retornar `{ error: "Informe CPF ou CNPJ — busca por nome não é permitida." }`.
  - Validar com `validateCPF`/`validateCNPJ` antes da query (mesmas regras do `upsert_cliente`, "validar antes de persistir/consultar").
- Atualizar o system prompt (chat.tsx:12) para instruir o modelo a sempre pedir CPF/CNPJ antes de chamar `buscar_cliente` (já praticamente faz isso, mas reforçar).
- Não mexer em `upsert_cliente` — já está chaveado por documento.

**Aceite**: `buscar_cliente` recusa qualquer match por nome isolado; só reconhece "cliente existente" via CPF/CNPJ validado.

## D2 — XLSX duas colunas + trava NULL + card dashboard

**Mudanças em `src/lib/financeiro.functions.ts`**
- Renomear coluna `margem` (H) para `margemEstimada` com header **"Margem estimada (30%)"**, fórmula por linha = `remuneracao * 0.30` (ou `value_cents * 0.30 / 100`, calculado em JS p/ não depender do Excel recalcular).
- Adicionar coluna nova `margemRealizada` (I) com header **"Margem realizada"**:
  - Se `supplier_paid_amount_cents IS NULL` OR `freight_paid_amount_cents IS NULL` → célula vazia (`null` no exceljs, vira "—" na UI).
  - Caso contrário → `(value_cents - supplier_paid_amount_cents - freight_paid_amount_cents) / 100`. Não usar `margin_cents` direto: o campo é GENERATED com COALESCE(...,0), então mascara custo NULL como zero — exatamente o bug que a trava precisa evitar.
- Linhas de total:
  - "TOTAL MARGEM ESTIMADA (30%)" → `SUM(H2:H{last})`.
  - "TOTAL MARGEM REALIZADA" → `SUM(I2:I{last})` (Excel ignora células vazias naturalmente).
  - Imposto 6% passa a incidir sobre **margem estimada** (mantém comportamento de hoje p/ DAS) — confirmar se você prefere sobre realizada; default mantém estimada.

**Dashboard (`src/routes/_authenticated/dashboard.tsx`)**
- Adicionar card "Margem realizada (mês)" que só renderiza quando existir pelo menos uma transação do mês com AMBOS `supplier_paid_amount_cents` e `freight_paid_amount_cents` não-nulos. Soma `(value - supplier - freight)` dessas linhas. Se nenhuma linha qualificar, o card não aparece (não mostra zero, não mostra receita).
- Precisa de uma `listDashboardMonth` (ou estender a que já existe) para retornar essas duas colunas de custo — vou checar o que já existe ao implementar.

**Aceite**: nenhuma célula/agregação de "Margem realizada" cai para receita cheia quando custo é NULL.

## C3 — probe Autentique (read-only, sem migration)

- Rodar via shell um script único usando `$AUTENTIQUE_API_TOKEN` contra `https://api.autentique.com.br/v2/graphql`:
  1. Introspection query (`__type(name: "Folder")` e `__schema { mutationType { fields { name args { name type { name ofType { name } } } } } }`) para confirmar:
     - existe `createFolder` e aceita `parent_id` (subpasta aninhada)
     - existe `moveDocumentToFolder` (ou equivalente) e quais argumentos
  2. Listar pastas existentes (`folders(limit:5){data{id name parent_id}}`) — só leitura, zero efeito colateral.
- Relatar resultado bruto (campos + tipos) aqui, com o trecho do schema. Só depois disso volto pra propor (ou descartar) a migration `clients.autentique_folder_id` + `ensureClientFolder`.
- Nada de schema/código de produto nesse passo.

**Aceite**: zero mudança em schema/código de produto antes do retorno do probe.

## Rename — "Assinatura" → "Plano/Cobrança"

- Trocar label `"Assinatura"` por `"Plano/Cobrança"` em:
  - `src/components/shell/AppSidebar.tsx:32`
  - `src/components/shell/ClaudeSidebar.tsx:39`
  - `src/components/shell/BottomNav.tsx` (entrada `/assinatura`)
  - Header da página `src/routes/_authenticated/assinatura.tsx:87` ("Assinatura inTermo" → "Plano/Cobrança").
- **Não** renomear a rota `/assinatura` (evita quebrar deep links, webhooks, e-mails). Só o rótulo visível muda.

**Aceite**: navegação mostra "Plano/Cobrança"; URL `/assinatura` continua funcionando.

## Ordem de execução

1. D1 + Rename (PR pequeno, dois arquivos do chat + 4 do shell/header).
2. D2 (financeiro.functions.ts + dashboard).
3. C3 probe (script shell, sem commit) → relato.

Nenhum desses passos toca schema do banco.
