## Enriquecer a seção "Dúvidas" com público-alvo e processo

Aproveitar o conteúdo da proposta antiga (público-alvo, CNAE de intermediação, vantagem fiscal, processo) sem reintroduzir nada do modelo manual via WhatsApp — a plataforma agora é autônoma.

### Onde mexer
Apenas `src/routes/index.tsx`:
- `faq` (array que alimenta a seção visual em `#faq`)
- JSON-LD `FAQPage` no `head()` (manter espelhado com o array)

Sem mudanças em componentes, rotas, backend ou em outras páginas.

### Novas entradas de FAQ (adicionadas no topo, antes da garantia)

1. **Pra quem é a inTermo?**
   Para lojistas que vendem sob encomenda — especialmente revenda de eletrônicos Apple (iPhone, Mac, iPad, Apple Watch) — que operam como intermediadores de negócios (CNAE 7490-1/04). Também serve pra quem mantém algum estoque mas precisa encomendar modelos específicos para vendas pontuais.

2. **Por que vender por encomenda como intermediação?**
   Operar no modelo de intermediação pode reduzir a carga tributária: os impostos incidem sobre a sua margem (o valor do serviço de intermediação), não sobre o preço cheio do produto. Pra isso valer, cada venda precisa de um contrato de prestação de serviço formalizado com o cliente.

3. **Como funciona na prática?**
   Você cria o contrato pelo app em poucos minutos (pelo celular, inclusive), envia o link de assinatura digital pro cliente, e acompanha tudo num painel só. Cada transação fica registrada, organizada e pronta pra repassar ao seu contador no fim do mês — sem planilha paralela, sem WhatsApp, sem depender de equipe externa.

4. *(mantidas)* Como funciona a garantia? · Funciona pelo celular? · Tem limite de contratos?

### Detalhes de execução

- Reordenar o array `faq` para: Pra quem é → Por que intermediação → Como funciona na prática → Garantia → Celular → Limite.
- Atualizar o JSON-LD `FAQPage` em `head()` (linhas ~30-75) para incluir as 3 novas perguntas com os mesmos textos, na mesma ordem. Isso preserva o ganho de SEO já existente.
- Linguagem: 2ª pessoa ("você"), tom direto, sem jargão fiscal pesado. CNAE só citado uma vez, com a referência completa `7490-1/04` pra quem procura.
- Sem alterar o componente visual da seção (já renderiza qualquer item do array). Sem novas dependências.

### Validação

- Aba anônima em `/` → rolar até "Dúvidas" → ver as 3 novas perguntas primeiro, com a resposta correta.
- Conferir `view-source` da home pra ver o JSON-LD atualizado com as 6 perguntas (bom pra rich results no Google).

### Fora do escopo (não vou tocar agora)

- Não vou criar uma seção "Pra quem é" separada no topo (eyebrow do hero já diz "Para quem vende sob encomenda"; mais que isso vira redundância).
- Não vou trazer preço/operação por encomenda da proposta antiga — esses dados já estão desatualizados pela mudança pro modelo de plataforma autônoma.
- Não vou mexer em `/termos`, `/privacidade` nem na página de assinatura.