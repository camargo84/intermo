Redesign visual completo da pele do site, mantendo todo texto, seções e fluxo. Toca tokens de design, fontes, variantes shadcn, shells e camadas decorativas. Único ajuste de markup permitido: alinhamento do hero (sem mudar textos).

## Ajustes confirmados sobre o plano anterior

1. **Acento azul-aço frio**, não índigo. Família baseada em `#3B82C4` (acento) / `#2E6FB0` (estado pressed / primary mais escuro). Sem nada de violeta.
2. **Glow do botão** recolorido pro mesmo azul-aço, mantido sutil.
3. **Hero alinhado à esquerda** — único trecho de markup tocado fora de tokens/skin.
4. **Grão** sem `mix-blend-overlay`. Vai usar `mix-blend-mode: soft-light` com fallback de noise branco a opacidade baixa (0.04–0.05) caso soft-light suma — afino até aparecer visível mas sutil sobre `#0A0A0B`.
5. **Dark default sim, mas light não quebra.** Mantenho ThemeToggle. Reviso `privacidade.tsx` (e demais) só o necessário pra coerência em light.

## 1. Tokens em `src/styles.css`

Paleta dark em camadas + azul-aço como acento. Light recalibrado pra continuar legível.

Dark:
- `--background` → `#0A0A0B` (camada 0)
- `--card` → `#131316` (camada 1)
- `--popover` → `#1C1C20` (camada 2)
- `--secondary` / `--muted` → `#131316`
- `--muted-foreground` → `#8B8B92`
- `--foreground` → `#F5F5F6`
- `--border` → `#23232A` (inputs/selects)
- `--input` → `#1C1C20`
- `--primary` → `#3B82C4` (azul-aço acento) — `hsl(208 53% 50%)`
- `--primary-foreground` → `#F8FAFC`
- `--accent` → `#2E6FB0` (variação mais profunda, pra hover/pressed e detalhes)
- `--ring` → `#3B82C4` a 60%

Light (tune mínimo pra coerência, mantém claro):
- `--background` → `#FCFCFD`, `--foreground` → `#0A0A0B`
- `--card` → `#FFFFFF`, `--muted` → `#F4F4F5`, `--muted-foreground` → `#52525B`
- `--border` → `#E4E4E7`
- `--primary` → `#2E6FB0` (mesmo azul-aço, leitura no claro)
- `--ring` → `#3B82C4`
- Bordas/sombras suaves; sem gradiente em botão.

Tokens utilitários novos (`@theme inline` + `:root`/`.dark`):
- `--surface-1/2/3` (espelham bg/card/popover)
- `--border-subtle: rgba(255,255,255,0.06)`, `--border-hairline: rgba(255,255,255,0.08)`, `--border-strong: rgba(255,255,255,0.12)` (no light, versões em `rgba(0,0,0,0.06/0.08/0.10)`)
- `--shadow-deep: 0 30px 60px -30px rgba(0,0,0,0.7), 0 18px 36px -18px rgba(0,0,0,0.5)` (dark) / sombras mais leves no light
- `--gradient-radial-steel`: glow azul-aço a baixa opacidade (`radial-gradient(closest-side, rgba(59,130,196,0.18), transparent 70%)`)
- `--gradient-radial-cool`: glow secundário ciano-frio dessaturado a ~5%
- Verificação AA: `--muted-foreground` contra `#0A0A0B` ≥ 4.5, primary text em `#3B82C4` background ≥ 4.5.

Substituo `--background-image-brand` antigo (gradiente índigo) pra deixar de gerar utilitário `bg-brand` chamativo; mantenho o nome mas valor sólido sutil.

## 2. Tipografia: Geist + Geist Mono

- `<link>` Geist Sans + Geist Mono em `src/routes/__root.tsx` (Google Fonts URL).
- `@theme inline`:
  - `--font-sans: "Geist", ui-sans-serif, system-ui, sans-serif`
  - `--font-display: "Geist", ui-sans-serif, sans-serif`
  - `--font-mono: "Geist Mono", ui-monospace, monospace`
- `@layer base`:
  - `h1, h2, h3` ganham `font-family: var(--font-display); font-weight: 600; letter-spacing: -0.02em;`
  - `[data-numeric], .font-mono, code, kbd, pre, [data-financial]` usam `--font-mono`, `font-feature-settings: "ss01","cv11"`.
- Remove referência a Inter no `<link>` antigo.

## 3. Botão sólido refinado (`src/components/ui/button.tsx`)

Reescrever apenas variantes (API intacta):
- `default`: `bg-primary text-primary-foreground` + `box-shadow: inset 0 1px 0 rgba(255,255,255,0.14), 0 8px 24px -12px rgba(59,130,196,0.45)` (glow azul-aço, sutil). Hover: `brightness(1.06)` + `translate-y-[-1px]`, transição `200ms ease-out`. Active: volta posição, sombra reduzida.
- `secondary`: `bg-[--surface-2] text-foreground border border-[--border-hairline]`, hover `bg-[--surface-3]`.
- `outline` / `ghost`: borda hairline / sem borda; hover `bg-white/[0.04]` (no light, `bg-black/[0.04]`).
- `destructive` recalibrado.
- Sem gradiente, sem neon.

## 4. Card refinado (`src/components/ui/card.tsx`)

- `bg-card border border-[--border-hairline] rounded-xl`
- `shadow-[--shadow-deep]` quando `data-elevated` está presente; padrão usa sombra mais sutil.

## 5. Navbar/Topbar com glass sutil

- `Topbar.tsx` (e `<header>` da landing em `index.tsx`): `bg-background/60 backdrop-blur-xl border-b border-[--border-hairline]`. Só classes — não mexe em markup/texto da Topbar.

## 6. Camadas decorativas globais — novo `<AmbientBackground />`

Montado no `RootComponent` (fixed inset-0 -z-10 pointer-events-none), com 3 sub-camadas:
1. **Glows radiais** (só dark):
   - Azul-aço a 8% opacidade no topo-esquerda (atrás do hero), usando `--gradient-radial-steel`.
   - Ciano-frio a 5% opacidade no canto inferior-direito.
   - `filter: blur(40px)` pra dispersar.
2. **Vinheta** muito sutil nas bordas pra reforçar profundidade.
3. **Grão (noise)**: SVG `feTurbulence` inline em base64, aplicado como camada absoluta full-screen, `mix-blend-mode: soft-light`, `opacity: 0.05` no dark e `opacity: 0.025` no light. Se em testes o grão sumir sobre `#0A0A0B` via soft-light, substituo por noise branco sem blend a `opacity: 0.04`. Garantia: tem que ser visivelmente perceptível ao aproximar, sutil de longe.

Tudo `pointer-events-none`. No light, glows somem (ou viram quase brancos a 3%), grão fica.

## 7. Hero da landing — alinhamento à esquerda (`src/routes/index.tsx`)

Único trecho onde mexo no markup. Restrições:
- **Não altero nenhum texto** (headline, subhead, pílula, CTAs, microcopy).
- Não altero outras seções.

Mudanças:
- Container do hero: de `text-center items-center` pra `text-left items-start`.
- Layout em grid 12 colunas no `md:` — conteúdo ocupa `md:col-span-7`, respiro à direita (`md:col-span-5` vazio, eventualmente com um glow ambient atrás).
- Pílula/tag: alinhada à esquerda, no topo do bloco.
- H1, parágrafo: `text-left`, max-width controlada (`max-w-[640px]`).
- Linha de CTAs: `justify-start` (não `justify-center`).
- No `sm` segue em coluna única, ainda left-aligned.
- Padding vertical e ritmo mantidos.

## 8. Inputs / Select / Tabs / Badge

- `input.tsx` / `textarea.tsx`: `bg-[--surface-2] border-[--border-hairline] focus-visible:border-primary/40 focus-visible:ring-0 focus-visible:shadow-[0_0_0_3px_rgba(59,130,196,0.18)]`.
- `select.tsx` / `popover.tsx` / `dialog.tsx`: `bg-popover` (camada 2) + hairline + `shadow-[--shadow-deep]`.
- `badge.tsx` default: `bg-white/[0.06] text-foreground border border-[--border-hairline] font-mono text-[11px] tracking-wide uppercase`. Outras variantes mantidas com tints baixos.

## 9. Detalhes finais

- **Dark como padrão**: ajustar o `themeBootstrap` em `__root.tsx` para usar `'dark'` como default quando não há valor salvo e quando não há preferência clara — o usuário ainda pode alternar via `ThemeToggle`.
- **Light continua funcional**: rodo `privacidade.tsx`, `termos.tsx`, `auth.tsx`, `login.tsx`, `signup.tsx`, `reset-password.tsx` visualmente; ajustes pontuais de classe (`bg-card`, `text-foreground`, `border-border`) se algo estiver usando cor hardcoded ou estiver com contraste ruim no light recalibrado. Sem reescrever páginas.
- `::selection { background: rgba(59,130,196,0.35); color: #fff; }`.
- Scrollbar fina escura no dark via `scrollbar-color`.
- Transições padrão `200ms ease-out` em base.

## Arquivos tocados

- `src/styles.css` — tokens dark/light recalibrados, novos tokens de superfície/borda/sombra/glow, fontes Geist, base layer pra display/mono, scrollbar, selection.
- `src/routes/__root.tsx` — `<link>` Geist + Geist Mono (substitui Inter), dark como default no bootstrap, montar `<AmbientBackground />`.
- `src/components/ambient-background.tsx` — novo, apenas visual.
- `src/components/ui/button.tsx` — variantes, glow azul-aço sutil.
- `src/components/ui/card.tsx`, `input.tsx`, `textarea.tsx`, `select.tsx`, `popover.tsx`, `dialog.tsx`, `badge.tsx` — pele e hairlines.
- `src/components/shell/Topbar.tsx` — classes glass (sem mudar markup).
- `src/routes/index.tsx` — header (classes glass) **+ hero realinhado à esquerda** (sem alterar textos).
- `src/routes/privacidade.tsx`, `termos.tsx`, `auth.tsx`, `login.tsx`, `signup.tsx`, `reset-password.tsx` — ajustes mínimos de classe só se necessário pra coerência no light.

## Fora de escopo

- Qualquer texto, copy, ordem ou conteúdo de seções.
- Lógica de auth, contratos, server functions, webhook.
- Componentes além dos shadcn primitives e shells listados.
- Mudança estrutural em qualquer seção que não seja o hero.

## Validação

- Visito `/` em dark e light pra checar hero, navbar, CTAs, glows, grão.
- Visito `/privacidade` em light pra garantir legibilidade.
- Verifico contraste AA do azul-aço sobre `#0A0A0B` e do `--muted-foreground` ambos os modos.
- Confiro que o build passa e que o ThemeToggle alterna sem flash.