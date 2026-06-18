
# Ajustes na landing e pricing

Mudanças localizadas em `src/routes/index.tsx`. Sem mexer em layout, paleta ou tokens. Apenas copy, contraste, preço e reformulação dos 4 passos.

## A. Acessibilidade (AA)

**A1. Botões `bg-brand` em branco**
- CTA do hero, CTA do card de pricing e botão "Começar grátis" do header recebem `text-primary-foreground` explícito (hoje herdam `text-foreground` do `Button` default e ficam escuros sobre o gradiente).
- Aplicar também no ícone (`ArrowRight`) por herança de `currentColor`.

**A2. Nav do header em light mode**
- Trocar `text-muted-foreground` por `text-foreground/80` no estado padrão dos links âncora `Como funciona / Preço / Dúvidas`, com `hover:text-foreground`. Dark mode permanece legível pelo mesmo token.

## B. Hero (substituir textos)

- Badge: mantém "Para quem vende sob encomenda".
- H1: **"Cliente empolgado não espera burocracia."**
- Sub: **"O 'fechado!' tem prazo de validade. A Intermo transforma a conversa em contrato assinado em minutos, com validade jurídica e a segurança que o seu negócio merece. Sem esfriar a venda, sem improviso."**
- CTA principal (`bg-brand`): **"Fechar antes de esfriar"**
- CTA secundário: **"Ver como funciona"** (mantém)
- Linha fina abaixo: **"Teste grátis por 7 dias. Sem cartão."**
- Atualizar `head().meta`:
  - `<title>`: "Intermo — Cliente empolgado não espera burocracia."
  - `description` e `og:title` alinhados à nova narrativa (sem mencionar integração com WhatsApp nem emissão de NF).

## C. Correção de copy (fidelidade ao produto)

**C1.** Remover qualquer promessa de integração/automação com WhatsApp. Permitido citar WhatsApp como o lugar onde a conversa acontece, nunca como integração.

**C2.** Remover qualquer promessa de "emissão de nota fiscal". Substituir por "deixa a nota pronta pro seu contador" / "organiza os dados da NF".

**C3. Novos 4 passos em "Como funciona"** (substituem o array `steps`):
1. **Crie o contrato em minutos** — "Assistente guiado coleta os dados (ou o cliente preenche pelo link) e monta o contrato." (ícone `FileSignature` ou similar)
2. **Contrato pronto e seguro** — "Modelo testado no mercado, atualizado com a legislação, com cláusulas de prazo, reembolso, multa e garantia." (ícone `ShieldCheck`)
3. **Assinatura com validade jurídica** — "O cliente assina pelo link, com validade jurídica garantida pela Lei 14.063/2020." (ícone `PenLine` / `Signature`)
4. **Margem e nota organizadas** — "Cálculo automático da margem e dados da NF prontos pro seu contador." (ícone `Calculator` ou `Receipt`)

Também ajustar o subtítulo da seção: "Quatro passos. Você fecha a venda, a Intermo formaliza." (remove qualquer menção a "WhatsApp → contrato").

Atualizar FAQ:
- Item "Funciona pelo celular?" → manter, sem citar integração.
- Trocar item de "200 contratos / excedente" por: **"Tem limite de contratos?"** → "Não. No plano Intermo os contratos e assinaturas são ilimitados."
- Manter "Preciso de cartão?" ajustado para 7 dias.

## D. Diferenciais em destaque

Adicionar um bloco curto (`section`) entre "Como funciona" e "Preço", usando os mesmos `Card` e tokens (sem nova paleta):

- **D1.** Card destaque com `ShieldCheck` em `text-accent`: "Assinatura digital com validade jurídica — Lei 14.063/2020."
- **D2.** Card com `BadgeCheck`: "Contrato revisado e atualizado conforme a legislação. Modelo testado em operação real."
- **D3.** Card/parágrafo de fechamento (sem citar concorrente): "Assinar um PDF qualquer um faz. A Intermo entrega o contrato certo, calcula sua margem e organiza a nota — não só a assinatura."

Grid de 3 colunas no desktop, 1 no mobile. Reaproveita `Card`, `shadow-card`, ícones já importados de `lucide-react`.

## E. Pricing (substituir card)

- Preço: **R$ 119/mês**, sem toggle anual.
- Remover qualquer menção a "200 contratos", cota, "R$ 1 excedente".
- Trial: **"Experimente grátis por 7 dias"** + linha menor: "Sem cartão. Até 3 contratos no teste."
- Linha de reforço logo abaixo do preço (dentro do header gradiente, em `text-primary-foreground/85`): **"Menos que a multa de um único contrato mal feito."**
- Nova lista `planFeatures`:
  1. Contratos ilimitados
  2. Assinatura digital com validade jurídica inclusa
  3. Modelo de contrato sempre atualizado
  4. Cálculo automático de margem
  5. Dados da nota prontos pro contador
  6. Sem fidelidade
- Botão CTA do card: "Começar grátis" com `text-primary-foreground` (A1).
- Título da seção: manter "Um plano. Sem pegadinha."; subtítulo: "Tudo o que você precisa para formalizar suas vendas sob encomenda sem esfriar o cliente."

## Fora do escopo
Sem alterações em outras rotas, componentes de marca, shell, dashboard, tokens CSS, ou copy de auth/legais. Sem novos arquivos.
