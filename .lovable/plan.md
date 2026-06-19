## Mudança de modelo: trial grátis → cobrança imediata com garantia de 7 dias

Apenas conteúdo de texto e rótulos de CTA. Nenhuma alteração em tokens, fontes, glows, grão, layout do hero, glass, hairlines, auth, contratos, server functions ou webhook.

### 1. `src/routes/index.tsx`

- **Navbar** (linha ~90): `"Começar grátis"` → `"Assinar agora"`.
- **Hero microcopy** (linha ~123): `"Teste grátis por 7 dias. Sem cartão."` → `"7 dias de garantia. Não gostou? Devolvemos 100%. Cancele quando quiser."`
- **Seção de preço — headline** (`"Um plano. Sem pegadinha."`) → `"Plano mensal. Cancele quando quiser."` Subtítulo mantido.
- **Card preço — CTA** (linha ~232): `"Experimente grátis por 7 dias"` → `"Assinar agora"`.
- **Card preço — texto pequeno** (linha ~235): `"Sem cartão. Até 3 contratos no teste."` → `"7 dias de garantia. Não gostou? Devolvemos 100%. Cancele quando quiser."`
- **FAQ** (linha ~250) — reescrever os itens para refletir o novo modelo, mantendo 3 perguntas:
  - "Preciso de cartão para começar?" → "Como funciona a garantia?" / Resposta: "Você assina e usa por 7 dias. Se não gostar, devolvemos 100% do valor. Cancele quando quiser."
  - "Funciona pelo celular?" → manter.
  - "Tem limite de contratos?" → manter (resposta já diz contratos ilimitados).
- **Meta description / og:description**: remover "Feche antes da venda esfriar — sem improviso" não tem "grátis"; deixar como está. Nenhum vestígio de trial nas metas.

### 2. `src/routes/login.tsx` (linha 58)

- `"Criar conta grátis"` → `"Criar conta"`.

### 3. `src/routes/signup.tsx` (linha 89)

- Subtitle `"14 dias grátis. Sem cartão de crédito."` → `"7 dias de garantia. Devolvemos 100% se não gostar."`

### 4. Varredura final

Já executada via `rg` por: grátis, gratis, trial, sem cartão, 7 dias, experimente. Os 7 hits acima cobrem todo o projeto (`src/`). Nada em `src/routes/termos.tsx`, `privacidade.tsx`, ou nos shells autenticados.

### Fora de escopo

Design system, tokens, Geist, ambient background, button glow, hero left-align, qualquer lógica de billing real, integração de pagamento, server functions, webhooks.
