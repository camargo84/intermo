import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { ComingSoon } from "@/components/shell/ComingSoon";

export const Route = createFileRoute("/_authenticated/contratos/")({
  head: () => ({ meta: [{ title: "Contratos — Intermo" }] }),
  component: () => (
    <ComingSoon
      icon={FileText}
      title="Contratos"
      description="Nenhum contrato ainda. Comece uma conversa e crie o primeiro em minutos."
    />
  ),
});
