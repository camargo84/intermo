# Plano — Domínio próprio intermo.com.br + e-mails

Você já tem `intermo.com.br` no Registro.br. Vamos usá-lo tanto pro app (publicação) quanto pra enviar e-mails (auth + transacionais), sem mexer no que o domínio fizer hoje (site institucional, e-mail corporativo, etc.).

## 1. Conectar o domínio ao app publicado

1. Publicar o projeto primeiro em `intermo.lovable.app` (pré-requisito pra conectar custom domain).
2. Em **Project Settings → Domains**, conectar `intermo.com.br` **e** `www.intermo.com.br` (precisam ser adicionados separadamente).
3. No painel do **Registro.br** (DNS do domínio), adicionar:
   - `A` em `@` → `185.158.133.1`
   - `A` em `www` → `185.158.133.1`
   - `TXT` em `_lovable` → valor que o Lovable exibir no diálogo (`lovable_verify=...`)
4. Definir `intermo.com.br` como **Primary** (o `www` redireciona pra ele).
5. Aguardar propagação DNS (até 72h, normalmente minutos) — Lovable provisiona SSL automaticamente.

> Importante: o Registro.br **não tem painel DNS por padrão**. Se você ainda não ativou os DNS do Registro.br ("Editar Zona"), precisa:
> - usar o DNS do próprio Registro.br (grátis, ativa em Painel → Editar Zona DNS), **ou**
> - apontar os nameservers do domínio pra outro provedor (Cloudflare grátis funciona muito bem). Me avisa qual prefere.

## 2. Configurar e-mails em `notify.intermo.com.br`

Pra não conflitar com qualquer e-mail corporativo que você venha a usar em `@intermo.com.br`, os e-mails do app saem do subdomínio `notify.intermo.com.br` (padrão e recomendado).

1. Abrir o diálogo de configuração de e-mail (Lovable Cloud → Emails):
   - Subdomínio sugerido: `notify.intermo.com.br`
   - Sender: `nao-responda@notify.intermo.com.br`
2. O Lovable mostra **2 registros NS** (algo como `ns3.lovable.cloud` / `ns4.lovable.cloud`) pra adicionar na zona DNS de `intermo.com.br` apontando o subdomínio `notify`.
3. Você adiciona esses NS no Registro.br (ou no Cloudflare, se migrarmos). A partir daí o Lovable gerencia SPF/DKIM/DMARC/MX automaticamente **somente nesse subdomínio** — seu domínio raiz e qualquer e-mail `@intermo.com.br` continuam intactos.
4. Após verificação DNS (minutos a horas), eu rodo:
   - **Scaffold de templates de autenticação** (signup, recovery, magic link, etc.) com branding INTERMO.
   - **Scaffold de templates transacionais** + 3 templates do app:
     - `payment-failed` — disparado pelo webhook AbacatePay
     - `contract-sent` — após envio bem-sucedido pra Autentique
     - `contract-signed` — disparado pelo webhook Autentique
   - **Triggers** nos handlers existentes (server-side, com retry; falha de e-mail não bloqueia o fluxo).
5. Página `/email/unsubscribe` com a identidade visual do app (gerada pelo scaffold) já incluída.

## 3. Ordem de execução

```text
A) Publicar em intermo.lovable.app (sem custom domain ainda)
B) Você cria os registros A + TXT no DNS de intermo.com.br
C) Você cria os 2 registros NS de notify.intermo.com.br
D) Eu rodo scaffold de auth + transacional + templates + triggers
E) Quando DNS propagar: testes de envio reais
F) Atualizar URLs dos webhooks (AbacatePay e Autentique) pra https://intermo.com.br/api/public/...
```

## Decisões pendentes (preciso confirmar antes de executar)

1. **DNS de `intermo.com.br`** — está usando os DNS do próprio Registro.br (Editar Zona ativado) ou um provedor externo (Cloudflare, etc.)? Isso decide onde você vai colar os registros.
2. **Subdomínio de envio** — confirma `notify.intermo.com.br`? Alternativas comuns: `mail.`, `email.`, `send.`.
3. **From visível** — algo como `INTERMO <nao-responda@notify.intermo.com.br>` está ok, ou prefere outro nome?

Sem código sendo alterado neste plano — só a sequência acima depois da sua confirmação.
