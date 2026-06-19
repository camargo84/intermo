# Pele "Sandclock terminal" no Intermo — implementação

Aplico o sistema visual do `DESIGN.md` na landing Intermo. Produto intacto: contratos para vendas sob encomenda, R$ 119/mês, garantia de 7 dias, CTA "Assinar agora". Pele + recomposição visual, sem mexer em auth, server functions, webhook, rotas autenticadas, contratos, PDFs, Termos, Privacidade ou dashboard.

## Decisões já travadas
- **Satoshi** (Fontshare) como substituto de Aeonik.
- **Painel de stats**: fade-in único ao entrar na viewport, sem loop, com `prefers-reduced-motion` respeitado. Valores qualitativos (sem números fabricados); sem badge `DEMO`.
- **ThemeToggle removido** da landing (dark-only). Mantido nos shells autenticados.
- **Base legal**: NÃO citar número de lei. Selo da strip diz apenas "Validade jurídica".

## 1. Tokens — `src/styles.css`
- `.dark` reescrito com tokens Sandclock (Abyss `#0a0a0a`, Carbon `#171717`, Graphite `#222`, Ash `#9b9b9b`, Chalk `#fff`, Signal Mint `#3fe280`).
- `@theme inline` exporta `--color-abyss/carbon/graphite/ash/chalk/signal-mint` para utilities (`bg-abyss`, `border-graphite`, `text-signal-mint`).
- Remover gradientes `--background-image-brand*` e radial steel/cool; sistema flat. Sombra única: `--shadow-subtle`.
- Body em tracking normal. Nenhum `letter-spacing` global. `.eyebrow` (uppercase 12px, tracking 0.12em, Ash) para labels.
- `.font-display` aplica Satoshi 400 com tracking -0.025em — usada só na headline do hero e no preço.
- Fontes: `--font-sans: Inter`, `--font-display: Satoshi`. Mono removida.
- Light mode (`:root`) vira fallback técnico mínimo (não exposto na landing).

## 2. Root — `src/routes/__root.tsx`
- `<link>` Google Fonts: Inter 400/500 + Satoshi 400 via Fontshare.
- Remover preconnects de Geist e os links de Geist/Geist Mono.
- Remover `<AmbientBackground />` do `RootComponent`.
- `theme-color` meta passa a `#0a0a0a`.

## 3. Componentes shadcn
- `Button` (`src/components/ui/button.tsx`): variant `default` → mint fill, text Abyss, radius 16, sombra subtle. `outline` → border Graphite, text Chalk. Nova variant `pill` → fill Chalk, text Abyss, radius full (CTA da navbar). Size `default` h-11 para tap target AA.
- `Card` (`src/components/ui/card.tsx`): radius 12, bg Carbon, border Graphite, sem shadow. Variant `live` (border Signal Mint) reservada ao painel de stats.
- `Badge` (`src/components/ui/badge.tsx`): pill Graphite + Chalk, Inter 500 12px.
- `Wordmark` (`src/components/brand/Wordmark.tsx`): "inter" Chalk + "mo" Signal Mint.

## 4. Novos arquivos
- `src/hooks/use-count-up.ts` — RAF + IntersectionObserver, easeOutCubic, dispara uma vez, respeita reduced-motion. Mantido para uso futuro caso surja métrica real.
- `src/components/landing/LivePanel.tsx` — painel Carbon com borda mint, 3 stats qualitativas, fade-in escalonado uma única vez.

## 5. Landing — `src/routes/index.tsx`
Recomposição completa, sem mexer em produto.

- **Top bar**: max-w 1200, hairline bottom Graphite. Logo à esquerda; nav central (Como funciona · Preço · Dúvidas) com underline mint 3px no item ativo via scrollspy `IntersectionObserver`; direita: link `Entrar` (ghost) + Button variant `pill` "Assinar agora".
- **Hero split 7/5**:
  - Esquerda: `<h1 class="font-display">` Satoshi 72px (clamp para mobile) — *Do "fechado" ao contrato assinado em minutos.* Sem itálico.
  - Direita: parágrafo Ash 16px + stack vertical: Button primary "Assinar agora" + Button outline "Ver como funciona". Microcopy 14px Ash: *"7 dias de garantia. Não gostou? Devolvemos 100%."*
- **Strip de confiança**: 4 selos brancos, sem bordas — `Validade jurídica` · `Assinatura digital` · `Dados criptografados` · `LGPD`. Ícone line 16px + label Inter 14px.
- **Painel de stats Intermo** (`LivePanel`): Carbon + border Signal Mint (única ocorrência), 3 colunas qualitativas, fade-in único.
- **Como funciona**: grid 2×2 de cards (4 passos atuais), ícone branco line 20px, título 20px Inter 500, body 14px Ash.
- **Por que Intermo**: 3 cards mesma receita, sem mint.
- **Plano**: max-w 720 centralizado, card Carbon hairline Graphite. Eyebrow `PLANO INTERMO`. Valor `R$ 119` em `font-display` 72px + `/mês` 20px Ash inline. 6 features com check mint 16px. Button primary full-width "Assinar agora". Microcopy 14px Ash: *"Cobrança imediata. 7 dias de garantia. Devolvemos 100% se não gostar. Cancele quando quiser."*
- **FAQ**: 3 cards flat (sem accordion). Conteúdo canônico já aprovado ("Como funciona a garantia?", "Funciona pelo celular?", "Tem limite de contratos?").
- **Footer**: logo + © · Termos · Privacidade · Entrar. Hairline top Graphite.

## 6. Auth (sem reescrita de layout)
- `signup.tsx` / `login.tsx` herdam os tokens. Garantir subtitle do signup exatamente: *"7 dias de garantia. Não gostou? Devolvemos 100%."*

## Arquivos tocados
- `src/styles.css`
- `src/routes/__root.tsx`
- `src/routes/index.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`
- `src/components/brand/Wordmark.tsx`
- `src/components/landing/LivePanel.tsx` (novo)
- `src/hooks/use-count-up.ts` (novo)

## Fora de escopo
Lógica de auth, server functions, webhook, rotas autenticadas, contratos, PDFs, Termos, Privacidade, dashboard, preço, garantia.
