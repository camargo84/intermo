import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { ComingSoon } from "@/components/shell/ComingSoon";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Intermo" }] }),
  component: () => (
    <ComingSoon
      icon={Settings}
      title="Configurações"
      description="Dados da empresa, equipe, integrações e plano — em breve."
    />
  ),
});
