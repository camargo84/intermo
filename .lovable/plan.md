
# Etapa 1 — Casca do **Intermo**

Escopo técnico inalterado em relação ao plano aprovado. Esta revisão incorpora a marca **Intermo** (nome, logo, ícone, gradiente, tom de voz) usando exclusivamente os tokens HSL já definidos no design system — nenhuma cor nova.

## 1. Marca Intermo (aplicada em toda a UI)

**Nome & copy**
- Produto: **Intermo** (substitui qualquer ocorrência de "Vento Norte Connect" / "Vento Norte"). Domínio: `intermo.com.br`.
- `document.title` padrão: `Intermo — Intermediar ficou simples.`
- Tagline do hero: **"Intermediar ficou simples."** acima da promessa "De conversa no WhatsApp a contrato assinado em menos de 5 minutos".
- Empty state de contratos: *"Nenhum contrato ainda. Comece uma conversa e crie o primeiro em minutos."*
- Microcopy em pt-BR direto, sem juridiquês; R$ 1.234,56; datas dd/MM/yyyy (date-fns locale ptBR).
- E-mails de auth (signup confirmação + recuperação de senha) em pt-BR assinados como "Equipe Intermo".

**Wordmark** (`src/components/brand/Wordmark.tsx`)
- Texto "intermo", Inter SemiBold (600), `tracking-tight`.
- "inter" em `text-foreground`, "mo" em `text-accent`.
- Posicionado no topo da sidebar (desktop), no header da landing e no header do shell mobile.
- Funciona em 1 cor (variant `mono` → tudo `currentColor`) e é legível a 16px de altura.

**Símbolo / ícone** (`src/components/brand/IntermoMark.tsx`)
- SVG: dois nós ligados por um arco/elo (A ↔ Intermo ↔ B). Stroke no tom `--accent`.
- Versão "tile": quadrado `rounded-lg` (8px) com fundo `bg-primary` e símbolo em `text-accent` (mantém contraste em light e dark sem cor hardcoded).
- Usado como favicon (PNG/SVG gerado), apple-touch-icon e ícone do app no header mobile.

**Gradiente de marca**
- Token único `--gradient-brand: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))` definido em `src/styles.css` e exposto via `@theme inline` como `--background-image-brand` (utilitário `bg-brand`).
- Reservado para: CTA principal do hero, botão "Começar grátis" no header da landing e o quota meter do dashboard. Em qualquer outro botão usar `variant="default"` shadcn padrão.

## 2. Backend (Lovable Cloud)
- Cloud habilitado (Postgres + Auth + Storage + Edge Functions).
- Sem migrations nesta etapa — `04_SCHEMA_SUPABASE.sql` roda no Prompt 1 da sequência.
- Auth: email + senha + recuperação. Sem provedores sociais.
- `/signup` apenas chama `supabase.auth.signUp` com dados da empresa em `options.data` (criação transacional do tenant fica para o próximo prompt).

## 3. Design system (`03_DESIGN_SYSTEM.md`)
- Tokens HSL light/dark em `src/styles.css` via `@theme inline` → `hsl(var(--token))`. Zero cor hardcoded em componentes.
- Paleta fiel ao spec: `--primary 222 60% 33%`, `--accent 200 85% 45%`, status `success/warning/destructive/info`, sidebar e charts.
- Fonte **Inter** (400/500/600/700) via `<link>` no `__root.tsx`.
- `font-variant-numeric: tabular-nums` em tabelas e valores financeiros.
- Raios, sombras suaves, transições 150–250ms.
- Dark mode com classe `.dark` no `<html>`, toggle no header (localStorage). Script anti-flash inline no `<head>` (SSR).

## 4. Rotas (TanStack file-based)
Públicas (SSR):
- `/` landing
- `/login`, `/auth` (alias → mesma tela), `/signup`
- `/reset-password`
- `/termos`, `/privacidade`

Protegidas (`_authenticated/route.tsx` integration-managed, redirect para `/auth`):
- `/dashboard`
- `/contratos`, `/contratos/novo` (placeholder "em breve")
- `/financeiro`, `/nfs`, `/configuracoes` (placeholders)

## 5. Landing (`/`)
Header (wordmark Intermo + nav âncora + "Entrar" / botão **`bg-brand`** "Começar grátis"), hero com tagline + promessa central + CTA gradiente, "Como funciona" em 4 passos (Chat → Contrato PDF → Assinatura digital → NFS + imposto), pricing card único (R$ 149/mês, 200 contratos, R$ 1 excedente, trial 14 dias / 10 contratos), footer com links legais + © Intermo. Responsivo, dark mode.

## 6. Auth
- `/signup`: dados da empresa (nome fantasia, razão social, CNPJ com máscara/dígitos, email, telefone) + MASTER (nome, email, senha forte) + checkbox de Termos. Redireciona para `/dashboard`.
- `/login`: email/senha + link "Esqueci minha senha".
- `/reset-password`: envio (`resetPasswordForEmail`) e form de nova senha quando hash `type=recovery`.
- `onAuthStateChange` único em `__root.tsx`, filtrado (SIGNED_IN/SIGNED_OUT/USER_UPDATED), invalida router e queries (sem refetch no SIGNED_OUT).

## 7. Shell autenticado
- Desktop: shadcn `Sidebar collapsible="icon"`, wordmark Intermo no topo, 6 itens (Dashboard, Novo Contrato/Chat, Contratos, Financeiro, NFS, Configurações).
- Mobile: bottom nav com 5 itens — Dashboard, **Chat**, Contratos, Financeiro, **Mais** (drawer com NFS, Configurações, tema, Logout).
- Header: nome da empresa (de user metadata), toggle dark mode, menu de usuário com Logout (cancel queries + clear cache → `signOut` → `/login`).

## 8. Dashboard esqueleto
5 cards de stats mockados (Contratos do mês, Pendentes de assinatura, Margem acumulada, Cota utilizada, DAS estimado) + quota meter com **gradiente de marca** animado + skeletons + empty states.

## 9. Páginas legais
`/termos` e `/privacidade` com layout simples, copy placeholder assinado por Intermo.

## 10. Stack
React 19 + TanStack Start + Tailwind v4 + shadcn/ui + TanStack Query + react-hook-form + zod + date-fns (ptBR) + lucide-react. Cliente Supabase em `@/integrations/supabase/client`. Tudo em pt-BR.

## Fora desta etapa
Edge function `signup-tenant`, CRUD clientes, chat-engine, geração PDF, Autentique, financeiro detalhado, NFS, billing, templates customizados de e-mail.
