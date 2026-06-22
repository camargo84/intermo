# Ajuste do mock de conversa em `/login`

## Verificação feita
O autocomplete de CEP **é real** no inTermo: `src/routes/api/chat.tsx` registra a tool `consultar_cep` que chama `lookupCEP` (ViaCEP) em `src/lib/validators.ts`. Não é mentira no marketing.

Limitação real do ViaCEP (que vou refletir no mock): CEPs gerais de município/bairro retornam sem logradouro — nesses casos o assistente precisa pedir a rua ao vendedor, não inventar.

## Mudanças em `src/components/auth/AuthLayout.tsx` (`ChatPreviewMock`)

1. **Endereço — deixar honesto sobre CEP geral**
   - Trocar "Endereço autocompletado. Cadastro salvo." por uma etapa de **confirmação explícita** do logradouro completo (rua + número + bairro + cidade/UF) com fallback claro: *"se for CEP geral, me diga o logradouro"*.
   - Incluir o **número** já no input do vendedor (CEP 01415-001, nº 220), porque ViaCEP não devolve número.

2. **Resumo completo antes de gerar**
   - Substituir a linha única atual por um bloco estruturado com:
     - Cliente (nome + CPF)
     - Endereço (rua, número, bairro, cidade/UF)
     - Produto (descrição + quantidade)
     - Valor
     - Forma de pagamento
   - Adicionar **forma de pagamento** explícita já no input ("PIX à vista") — antes estava embutido no valor.

3. Manter o resto do fluxo (busca de cliente, geração de PDF, pergunta sobre link de assinatura via WhatsApp), que reflete o que o sistema realmente faz.

## Aceite
- Mock não promete autocomplete mágico: mostra a consulta ViaCEP + confirmação + fallback para CEP geral.
- Resumo pré-geração lista cliente, endereço, produto, valor e forma de pagamento.
- Sem mudanças em lógica/back-end — só copy do componente visual de preview.
