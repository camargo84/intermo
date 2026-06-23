# Corrigir contraste do app

## O que está acontecendo no print

A tela enviada está em **dark mode** — sidebar e fundo escuros. Os campos do formulário aparecem com fundo **branco e texto branco** (ilegíveis) porque o Chrome desenha campos com **autofill** usando estilos próprios (fundo claro/amarelo) que sobrescrevem o tema escuro. Não é "light mode" — é o autofill do navegador estragando os inputs do dark mode.

Além disso, o **light mode** real (para quem trocar pelo toggle) está com contraste fraco em vários tokens (cinza-sobre-branco demais, bordas quase invisíveis, primary mint sobre branco com pouca legibilidade).

## Mudanças

### 1. Eliminar a "tela branca" dos inputs com autofill (`src/styles.css`)

Adicionar regra global para que valores preenchidos pelo Chrome respeitem o tema:

```css
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus,
textarea:-webkit-autofill,
select:-webkit-autofill {
  -webkit-text-fill-color: hsl(var(--foreground));
  -webkit-box-shadow: 0 0 0 1000px hsl(var(--input)) inset;
  caret-color: hsl(var(--foreground));
  transition: background-color 9999s ease-in-out 0s;
}
```

Resultado: campos autofilled ficam com fundo `--input` (cinza escuro no dark, cinza claro no light) e texto `--foreground` — legíveis nos dois temas.

### 2. Repintar o light mode com contraste sério (`src/styles.css`, bloco `:root`)

Tokens atuais usam cinzas muito claros (`muted-foreground: 0 0% 36%`, `border: 0 0% 90%`) e primary mint `#3fe280` sobre branco — péssima leitura. Ajustes:

- `--background`: branco quente `0 0% 99%` (não puro 100%).
- `--foreground`: `0 0% 9%` (preto suave, mais legível que `4%`).
- `--card` / `--surface-1..3`: escala neutra com mais separação (`100% / 97% / 93%`) para criar profundidade visível.
- `--muted-foreground`: subir para `0 0% 30%` (WCAG AA em 14px).
- `--border` / `--input`: `0 0% 86%` (mais visível que 90%).
- `--primary`: trocar mint claro por **coral editorial** `15 60% 45%` (token `--color-coral` da paleta) com `primary-foreground` branco — alto contraste em CTA, mantém identidade Claude/warm.
- `--ring`: alinhar ao novo primary.
- `--sidebar`: `0 0% 97%` com borda `0 0% 88%`.
- `--accent`: cinza neutro `0 0% 94%` com texto preto, para hover de itens de menu não brigar com o primary.
- `--destructive`: subir saturação `0 75% 42%` para destacar em fundo claro.

### 3. Garantir bordas visíveis em light (`src/styles.css`)

`--border-subtle/--border-hairline/--border-strong` no `:root` hoje são `rgba(0,0,0,0.06/0.1/0.16)` — subir para `0.10/0.14/0.22` para que cards e divisores apareçam em fundo claro.

### 4. Reset global de `color-scheme`

Hoje `html { color-scheme: dark }` é forçado no CSS. Remover essa linha (o bootstrap script em `__root.tsx` já seta `documentElement.style.colorScheme` conforme o tema atual). Sem isso, no light mode o Chrome continua pintando elementos nativos (scrollbar, autofill) com aparência dark.

## Escopo NÃO incluído

- Sem mudar nenhum componente individual; tudo via tokens.
- Sem alterar o dark mode (já está aprovado pelo usuário).
- Sem mexer em rotas, lógica ou backend.

## Arquivos editados

- `src/styles.css` (autofill + bloco `:root` light + remover `color-scheme: dark` fixo)