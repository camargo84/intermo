import { createFileRoute, redirect } from "@tanstack/react-router";

// Rota legada: a antiga tela "Notas de serviço" (placeholder ComingSoon) foi
// substituída pela página /financeiro, que já entrega a listagem mensal e o
// export XLSX no modelo da planilha de NFS. Mantemos a rota apenas como
// redirect permanente para não quebrar links antigos.
export const Route = createFileRoute("/_authenticated/nfs")({
  beforeLoad: () => {
    throw redirect({ to: "/financeiro", replace: true });
  },
});
