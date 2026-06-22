import { createFileRoute, redirect } from "@tanstack/react-router";

// Rota legada: "Contratos" virou "Transações". Mantém os links antigos vivos.
export const Route = createFileRoute("/_authenticated/contratos/")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/transacoes", search: search as never });
  },
});
