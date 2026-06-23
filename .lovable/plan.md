## Objetivo
Tirar o login com Google, manter só email + senha (com reset de senha e confirmação de email), e fazer com que todos os e-mails de autenticação cheguem em português, com a marca inTermo, vindos de um remetente `@intermo.com.br`.

## 1. Remover Sign in with Google
- `src/routes/login.tsx`: remover botão "Continuar com Google", `onGoogle`, `googleLoading`, divider "ou", import de `lovable` e ícone Google.
- `src/routes/signup.tsx`: mesma limpeza. O cadastro fica só pelo formulário com email + senha.
- `src/routes/auth.tsx`: se houver atalho Google, remover.
- Chamar a configuração de provedores para **desativar Google** e manter **email** ativo (sem auto-confirmação — usuário precisa confirmar o e-mail).

## 2. Domínio de envio @intermo.com.br
Hoje os e-mails saem do remetente padrão da Lovable. Para usar `@intermo.com.br` precisamos configurar o domínio de e-mail da Lovable. Isso é feito uma única vez por você num diálogo que abre no chat:

```text
<presentation-actions>
<presentation-open-email-setup>Configurar domínio de e-mail</presentation-open-email-setup>
</presentation-actions>
```

Você escolhe um subdomínio (recomendo `notify.intermo.com.br`) e o remetente visível pode continuar sendo, por exemplo, `nao-responda@intermo.com.br`. A Lovable cuida de SPF/DKIM/DMARC. Os e-mails só passam a sair de fato depois que o DNS for verificado (geralmente minutos, pode levar até algumas horas).

## 3. Templates em PT-BR com logo inTermo
Depois do domínio configurado, vou criar os 6 templates de autenticação como componentes React Email, todos em português brasileiro e com a identidade inTermo:

1. **Confirmação de cadastro** — "Bem-vindo(a) ao inTermo, confirme seu e-mail"
2. **Recuperação de senha** — "Redefina sua senha do inTermo"
3. **Magic link** — "Seu link de acesso ao inTermo"
4. **Convite** — "Você foi convidado para o inTermo"
5. **Troca de e-mail** — "Confirme a alteração do seu e-mail"
6. **Reautenticação** — "Confirme sua identidade"

Cada template terá:
- Cabeçalho com a marca inTermo (o símbolo atual é SVG; vou exportá-lo como PNG hospedado em `public/` para que clientes de e-mail renderizem)
- Saudação, explicação curta, botão de ação grande, link alternativo
- Rodapé com aviso "Se você não solicitou, ignore este e-mail" e assinatura "Equipe inTermo"
- Tipografia, cores e botão coerentes com o app (fundo branco por exigência de deliverability)

## 4. Página `/reset-password` (já existe)
Garantir que o link do e-mail de recuperação leve para `https://intermo.com.br/reset-password` e que o `redirectTo` na chamada `resetPasswordForEmail` use `window.location.origin + '/reset-password'`.

## 5. Confirmação de e-mail no cadastro
- `supabase.auth.signUp` já passa `emailRedirectTo`; vou apontar para `${origin}/login?confirmed=1` e exibir um toast "Confirme seu e-mail para entrar".
- Não habilitar auto-confirm — o usuário precisa clicar no link.

## Ordem de execução (build mode)
1. Limpar Google das telas de login/signup/auth e desativar o provider Google (mantendo email).
2. Pedir a você para abrir o diálogo de configuração de domínio de e-mail (passo manual — só você consegue concluir).
3. Assim que o domínio estiver registrado (mesmo com DNS ainda propagando), rodar o scaffolding dos templates de auth.
4. Reescrever os 6 templates em PT-BR com a marca inTermo.
5. Ajustar `emailRedirectTo` no signup e no reset.

## Observações
- Não vou mexer em `src/integrations/supabase/*` (auto-gerado).
- Os e-mails da Autentique (assinatura de contrato) não são afetados — isto é só sobre os e-mails de autenticação do app.
- Marketing/newsletter não entra aqui; só transacionais de auth.
