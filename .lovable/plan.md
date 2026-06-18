## Objetivo
Remover toda menção a "nota fiscal", "NFS", "imposto" e "DAS" da landing page (`src/routes/index.tsx`), ajustando copy e ícone conforme especificado. Nenhuma alteração de layout, paleta ou tokens.

## Escopo
Apenas `src/routes/index.tsx`. Meta tags em `__root.tsx` já estão limpas.

## Mudanças

1. **Passo 4 — "Como funciona"**
   - Título: `Margem e nota organizadas` → `Tudo pronto pro seu contador`
   - Texto: `Cálculo automático da margem e dados da nota prontos pro seu contador.` → `As informações de cada transação ficam organizadas e prontas pra você enviar ao seu contador. Sem planilha, sem garimpo.`
   - Ícone: `Calculator` → `FileSpreadsheet` (neutro, organização/planilha)

2. **Lista de benefícios (Pricing)**
   - Substituir item `Dados da nota prontos pro contador` por `Transações organizadas pro seu contador`
   - Remover qualquer outro item que cite imposto/DAS/NF (nenhum presente atualmente)

3. **Bloco "Por que Intermo" (diferenciais)**
   - Subtítulo da seção: ajustar `organiza a nota` para referência neutra às informações/transações
   - Card "Mais que assinatura": `Margem calculada automaticamente e dados da nota prontos pro seu contador` → `Margem calculada automaticamente e transações organizadas pro seu contador`

## O que NÃO muda
- Layout, cores, tipografia, espaçamentos, animações
- Componentes de brand, shell, auth, rotas autenticadas
- Termos, privacidade, e-mails