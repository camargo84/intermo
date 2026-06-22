# Starter padrão + chips contextuais no chat real

Hoje o `/chat` (entrada) tem um starter fixo demais ("Gerar contrato — iPhone 15 Pro…") e o `/chat/$contractId` (conversa em andamento) não tem nenhuma ação rápida — só campo de texto. Vou padronizar com um **starter único** na entrada e uma **barra de chips contextuais** que evolui com a conversa.

## 1. `/chat` (entrada) — `src/routes/_authenticated/chat.index.tsx`

- Remover o cartão starter atual com o prompt comprido de iPhone.
- Substituir por **um único chip "Criar transação"** logo abaixo do composer.
- Clicar no chip preenche o composer com `"Quero criar uma nova transação."` e dispara o envio (cria draft + abre `/chat/$contractId` com a mensagem inicial — mesmo fluxo atual de `start(prompt)`).
- Manter input livre acima — quem quiser já descrever a venda direto, descreve.

## 2. `/chat/$contractId` (conversa) — `src/routes/_authenticated/chat.$contractId.tsx`

Adicionar uma **linha de chips de ação rápida acima do composer** (entre o histórico e o textarea). Os chips são derivados do estado atual da transação e mudam à medida que a conversa progride. Clicar num chip envia a mensagem correspondente (mesmo path do `send()`).

Estados e chips (mostrar 2–3 mais relevantes por vez, na ordem):

| Estado atual                                  | Chips sugeridos                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| Sem cliente cadastrado                        | **Cadastrar cliente** · Buscar cliente existente                         |
| Cliente ok, sem produto                       | **Adicionar produto** · Adicionar serviço                                |
| Produto ok, sem forma de pagamento            | **Definir forma de pagamento** (PIX à vista / parcelado / boleto)        |
| Tudo preenchido, sem PDF                      | **Gerar contrato** · Revisar resumo                                      |
| PDF gerado, sem assinatura                    | **Enviar link de assinatura por WhatsApp** · Baixar PDF                  |
| Contrato assinado, sem pagamento do cliente   | **Registrar pagamento do cliente**                                       |
| Cliente pago, sem pagamento ao fornecedor     | **Registrar pagamento ao fornecedor**                                    |
| Tudo pago                                     | **Consolidar transação** (mesma ação que já existe no header)            |

Derivação do estado:
- `client_name`, `pdf_path`, `signed_pdf_path`/`status === "signed"`, `client_paid_at`, `supplier_paid_at`, `freight_paid_at` já vêm em `ContractSummary` (e em `data.contract` do `getChatThread`).
- "Sem produto" / "sem forma de pagamento" precisam de 2 campos extras no select de `getChatThread` (`src/lib/chat.functions.ts`): `has_items` (`exists` de `contract_items`) e `payment_method` (campo em `contracts`/`transactions`). Vou adicionar só o que falta, sem mudar schema.

Comportamento dos chips:
- Cada chip tem `label` curto + `prompt` que ele envia. Ex.: chip "Adicionar produto" envia `"Quero adicionar um produto."` e o agente segue o próprio roteiro pedindo descrição/quantidade/valor.
- Os chips **desaparecem** enquanto `status === "submitted" | "streaming"` para não competirem com o "Pensando…".
- "Enviar link de assinatura por WhatsApp" reaproveita a função `openWhatsapp()` já existente (não passa pelo agente).
- "Baixar PDF" reaproveita `onOpenPdf` que já existe.
- "Consolidar transação" reaproveita `handleConsolidate`.

## 3. Visual

- Chips em linha horizontal com scroll horizontal no mobile, altura compacta, mesma família do design (border `border/60`, fundo `card/60`, hover sutil), com ícone do lucide à esquerda. Reaproveitar tokens existentes — sem cor nova.
- Sem mudança de layout do composer ou do header.

## Aceite
- Em `/chat` aparece exatamente **um chip "Criar transação"**; clicar inicia a conversa.
- Em qualquer `/chat/$contractId`, a linha de chips reflete o próximo passo lógico do contrato e some quando o agente está respondendo.
- Conforme o contrato avança (cliente cadastrado → produto → pagamento → PDF → assinatura → pagamentos → consolidação), os chips mudam sozinhos sem reload.
- Nenhum chip envia ação que o sistema ainda não faz hoje (todas mapeiam para mensagens que o agente já trata, ou para `openWhatsapp` / `onOpenPdf` / `handleConsolidate` existentes).

## Pergunta para você antes de implementar
Os chips devem **enviar a mensagem imediatamente** ao clicar (mais rápido, 1 toque), ou **só preencher o textarea** para você editar antes de enviar? Padrão sugerido: enviar imediatamente.
