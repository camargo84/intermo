## Revisão de copy da landing — remoção de promessas de WhatsApp e nota fiscal

Escopo: landing page (hero, header, pricing, FAQ e rodapé) + meta tags globais.

### Problemas encontrados
1. **Meta tags em `src/routes/__root.tsx`** — description e `og:description` ainda dizem "Do WhatsApp ao contrato assinado em menos de 5 minutos".
2. **Step em `src/routes/index.tsx`** — "Margem e nota organizadas" ainda usa "dados da **nota fiscal** prontos pro seu contador", quando a copy aprovada é "dados da **nota** prontos pro seu contador" (sem a palavra "fiscal", pois não emitimos NF).

### Correções
- Substituir as meta tags de `__root.tsx` para remover a menção ao WhatsApp e manter a narrativa de "transformar a conversa em contrato" (alinhada ao hero atual).
- Substituir "nota fiscal" por "nota" na descrição do passo 4 em `index.tsx`.

Nenhuma outra menção a WhatsApp ou emissão de nota fiscal foi encontrada no restante do projeto.

### Fora do escopo
Sem alterações em layout, paleta, tokens, componentes de marca, shell, dashboard ou rotas de auth/legais.