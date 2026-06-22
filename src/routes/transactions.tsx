import { createFileRoute, redirect } from "@tanstack/react-router";

// Redirect legado: /transactions (EN) → /transacoes (PT-BR, canônica).
export const Route = createFileRoute("/transactions")({
  beforeLoad: () => {
    throw redirect({ to: "/transacoes", search: { status: "all", q: "" } });
  },
});
