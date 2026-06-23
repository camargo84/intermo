
## Contexto da tela do print

A tela "Grant permission to InTermo / Lovable" **não é uma tela da nossa app** — é o broker OAuth gerenciado pela Lovable Cloud (`oauth.lovable.app`). Por isso o logo é da Lovable, o título do navegador é "Lovable" e os textos vêm em inglês. Não tem como traduzir nem rebrandar essa tela usando código nosso: ela é servida pela infraestrutura da Lovable.

Existem **dois caminhos** para o usuário ver uma tela bonita, em português e sem a marca Lovable:

### Caminho A — BYOC (recomendado para produção) ✅
Usar credenciais próprias do Google (Client ID + Secret seus, no Google Cloud Console). Quando ativado:
- O consent screen passa a ser **diretamente do Google** (accounts.google.com), automaticamente em pt-BR pelo idioma do navegador.
- Aparece **"InTermo quer acessar sua Conta Google"** com o logo que você configurar no Google Cloud.
- Sem nenhuma menção a Lovable, sem o passo intermediário do broker.
- Aba do navegador mostra "Fazer login - Contas do Google".

**O que você (usuário) precisa fazer no Google Cloud Console** (faço um passo-a-passo claro quando aprovar):
1. Criar projeto → OAuth Consent Screen com nome "InTermo", logo, domínio `intermo.com.br`.
2. Criar credenciais OAuth Client (Web) com o redirect URI que mostro.
3. Colar Client ID + Secret nas Authentication Settings do backend.

Depois disso o broker da Lovable some do fluxo.

### Caminho B — manter broker Lovable
Nada muda visualmente: continua em inglês com logo da Lovable. Não tem flag para traduzir.

---

## 1. Onboarding pós-Google (dados da empresa)

Hoje, ao entrar com Google, o usuário cai direto no dashboard com o `profiles` praticamente vazio (só nome e e-mail do Google). O `/signup` por e-mail/senha coleta CNPJ, razão social, telefone, etc., mas o Google pula tudo isso. Resultado: na primeira tentativa de gerar contrato, o agente bloqueia com "faltam: CNPJ, razão social, endereço, ...".

**Solução**: gate de onboarding obrigatório.

- Nova rota `_authenticated/onboarding.tsx` com formulário enxuto (2 passos):
  - **Passo 1 — Empresa**: razão social, nome fantasia, CNPJ (com validação), telefone, e-mail comercial, endereço, cidade/UF, CEP.
  - **Passo 2 — Representante & foro**: nome do representante, CPF, qualificação ("sócio administrador" como sugestão), comarca de foro, margem padrão.
  - Botão "Pular por enquanto" só some quando todos os campos críticos estão vazios — depois fica como "Salvar e continuar".
- No `_authenticated/route.tsx`, depois do `getUser`, busca `profiles` e redireciona para `/onboarding` se algum campo crítico estiver faltando (`company_cnpj`, `company_legal_name`, `company_address`, `company_city`, `company_uf`, `representative_name`, `comarca`). Onboarding em si fica fora desse gate para não dar loop.
- Pré-preenche `ownerName` e `companyEmail` com o que veio do Google (`user.user_metadata.full_name`, `user.email`).
- Trigger no banco já cria o row em `profiles` no signup (verificar; se não tiver, adicionar migration).

## 2. Preflight do agente ao gerar contrato

Hoje `src/routes/api/chat.tsx` (linhas ~363-396) já valida o `profiles` antes de gerar, mas:
- A checagem só dispara dentro da tool `generate_contract` — o agente pode propor gerar e só descobre que falta no último passo.
- Cliente exige só CPF/CNPJ e e-mail; faltam endereço/cidade do cliente, que entram no preâmbulo do contrato.

**Mudanças**:
- Adicionar tool `preflight_contract({ client_id })` que o agente **deve chamar antes** de `generate_contract`. Retorna `{ ok, missing_profile: [...], missing_client: [...] }`.
- System prompt passa a instruir: "Antes de propor gerar contrato, chame `preflight_contract`. Se houver pendências, pergunte/peça os dados que faltam (no caso do perfil da empresa, oriente abrir Configurações; no caso do cliente, peça no chat e use `upsert_client` para completar)."
- Estender `upsert_client` para aceitar `address`, `city`, `uf`, `cep` (já tem coluna nos `transactions`/`clients`? verifico na implementação; se faltar, migration curta).
- Lista de campos obrigatórios fica num único arquivo (`src/lib/contract-requirements.ts`) usado pelo preflight, pelo `getMyProfile` e pelo onboarding — fonte única da verdade.

## 3. Pequenos polimentos da tela `/login` e `/signup`

Só o que dá pra fazer no nosso lado (o broker é intocável):
- Garantir que os textos em todas as telas próprias estão em pt-BR (já estão, mas reviso mensagens de erro do `lovable.auth.signInWithOAuth`).
- Confirmar `favicon.ico` e `<title>` corretos em `/auth` (já existe, mas a aba do broker é da Lovable — só BYOC resolve).

---

## Pergunta antes de implementar

Você quer seguir o **Caminho A (BYOC, recomendado)** para a tela ficar 100% em pt-BR e sem Lovable? Se sim, ao aprovar:
1. Implemento o **onboarding** + **preflight do agente** agora.
2. Te entrego um **passo-a-passo numerado** do Google Cloud Console + onde colar as credenciais (nada precisa ser commitado — fica nas Auth Settings do backend).

Se preferir o Caminho B, faço só onboarding + preflight e a tela do broker continua igual.

## Arquivos afetados
- `src/routes/_authenticated/onboarding.tsx` (novo)
- `src/routes/_authenticated/route.tsx` (gate de onboarding)
- `src/lib/profiles.functions.ts` (server fn `getProfileCompleteness`)
- `src/lib/contract-requirements.ts` (novo, fonte única)
- `src/routes/api/chat.tsx` (tool `preflight_contract`, system prompt)
- `src/lib/agent.functions.ts` (reuso da lista única)
- migration leve, se faltar colunas de endereço em `clients`
