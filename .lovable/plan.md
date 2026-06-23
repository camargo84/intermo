# Correções no contrato gerado (modelo inTermo)

Dois problemas no PDF anexado:

1. **Minuta errada.** O template atual é “Compra e Venda de Bens Móveis”. O modelo de referência (Vento Norte) é **Contrato de Encomenda / Intermediação de Serviços**, e é esse que a inTermo precisa usar — com adaptações pedidas por você.
2. **“Local e data: Casimiro de Abreu/RJ” aparecendo por padrão.** O código já lê do perfil; o problema é que o perfil hoje está salvo como `Rua das Flores, 50 — Casimiro de Abreu/RJ — Comarca Casimiro de Abreu/RJ` (dado antigo). Vou eliminar a linha “Local e data” fixa e deixar a Autentique carimbar local/data/IP, e em paralelo confirmar que o cadastro da empresa em Configurações já é editável (é).

## O que vou fazer

### 1. Nova minuta (`src/lib/contracts.pdf.server.ts`)

Reescrever `renderContractPdf` no formato Vento Norte, **adaptado para a inTermo**:

- **Título:** `CONTRATO DE ENCOMENDA`
- **DAS PARTES**
  - `CONTRATANTE:` cliente — nome, qualificação (PF: nacionalidade, estado civil, CPF; PJ: CNPJ), endereço completo do cadastro, e-mail, celular.
  - `CONTRATADA:` empresa — razão social, CNPJ, endereço, e-mail, celular, representada por nome do representante (nacionalidade, estado civil, CPF).
- **Cláusulas**
  1. **DO OBJETO** — prestação de serviços na modalidade intermediação.
  2. **EXECUÇÃO DOS SERVIÇOS** — lista de produtos (descrição, qtd, especificações vindas do cadastro do produto).
  3. **PRAZO, PRORROGAÇÃO E REEMBOLSO** — 7 dias úteis, prorrogação única por 15 dias, reembolso em 5 dias úteis.
  4. **REMUNERAÇÃO** — valor total + por extenso, despesas inclusas.
  5. **FORMA E LOCAL DE PAGAMENTO** — **sem simulação de parcelamento**. Texto montado conforme `forma_pagamento`:
     - `avista` → “à vista (dinheiro / transferência / PIX), referente ao valor total de R$ X.”
     - `parcelado` → “parcelamento no cartão em N vezes, sendo os juros conforme simulação apresentada à parte CONTRATANTE.”
     - `misto` → “entrada de R$ X (dinheiro / transferência / PIX) + saldo no cartão em N vezes, sendo os juros conforme simulação apresentada à parte CONTRATANTE.”
     Nenhum valor de parcela calculado/simulado dentro do contrato.
  6. **MULTAS** — 20% sobre o valor do contrato.
  7. **FORTUITO OU FORÇA MAIOR** — art. 393 CC.
  8. **DISPOSIÇÕES GERAIS** — autorização de uso de dados para intermediação, garantia de funcionamento no Brasil, garantia de 12 meses do fabricante.
  9. **FORO** — Comarca do `comarca` cadastrado no perfil.
- **Encerramento** (sem testemunhas, sem “Local e data: …”):
  ```
  CONTRATADA: <razão social>
  CNPJ nº: <cnpj>

  CONTRATANTE: <nome do cliente>
  CPF/CNPJ nº: <doc>
  ```
  Data/local/IP ficam por conta da Autentique (válido juridicamente pela MP 2.200-2/2001).

### 2. Sem fallback de cidade/UF/comarca

Remover qualquer `?? "—"` no PDF. Se faltar campo essencial, o `assertProfileReadyForContract` já bloqueia e direciona para `/configuracoes`.

### 3. Passar campos novos do cliente

`ContractClient` ganha `email` e `telefone`; `contracts.functions.ts` (ou de onde vier `args.cliente`) passa esses dois campos do cadastro do cliente para o renderer.

## Arquivos alterados

- `src/lib/contracts.pdf.server.ts` — minuta nova + interface `ContractClient` ampliada (`email`, `telefone`) + remoção de “Local e data” e de fallbacks `—`.
- Local que chama `renderContractPdf` (provável `src/lib/contracts.functions.ts` / `src/routes/api/chat.tsx`) — passar `email`/`phone` do cliente.

## O que NÃO muda

- Header com logo e footer com paginação.
- Pipeline Autentique + link wa.me (já implementados).
- Schema do banco.

Se aprovar, implemento direto.
