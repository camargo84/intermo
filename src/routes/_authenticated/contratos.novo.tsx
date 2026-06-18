import { createFileRoute } from "@tanstack/react-router";
import { MessageSquarePlus } from "lucide-react";
import { ComingSoon } from "@/components/shell/ComingSoon";

export const Route = createFileRoute("/_authenticated/contratos/novo")({
  head: () => ({ meta: [{ title: "Novo contrato — Intermo" }] }),
  component: () => (
    <ComingSoon
      icon={MessageSquarePlus}
      title="Novo contrato"
      description="O chat que transforma uma conversa em contrato chega na próxima etapa."
    />
  ),
});
