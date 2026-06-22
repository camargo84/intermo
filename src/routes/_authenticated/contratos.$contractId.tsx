import { createFileRoute, redirect } from "@tanstack/react-router";

// Rota legada: redireciona para os detalhes da transação preservando o id.
export const Route = createFileRoute("/_authenticated/contratos/$contractId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/transacoes/$contractId",
      params: { contractId: params.contractId },
    });
  },
});
