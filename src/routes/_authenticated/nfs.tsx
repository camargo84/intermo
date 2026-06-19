import { createFileRoute } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { ComingSoon } from "@/components/shell/ComingSoon";

export const Route = createFileRoute("/_authenticated/nfs")({
  head: () => ({ meta: [{ title: "NFS — inTermo" }] }),
  component: () => (
    <ComingSoon
      icon={Receipt}
      title="Notas de serviço"
      description="A emissão automática de NFS chega na próxima etapa."
    />
  ),
});
