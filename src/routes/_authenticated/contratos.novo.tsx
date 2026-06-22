import { createFileRoute, redirect } from "@tanstack/react-router";

// Rota legada: redireciona para a nova rota de criação de transação.
export const Route = createFileRoute("/_authenticated/contratos/novo")({
  beforeLoad: () => {
    throw redirect({ to: "/transacoes/novo" });
  },
});
