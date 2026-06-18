import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { ComingSoon } from "@/components/shell/ComingSoon";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Intermo" }] }),
  component: () => (
    <ComingSoon
      icon={Wallet}
      title="Financeiro"
      description="Receitas, margem e DAS estimado vão aparecer aqui assim que você emitir o primeiro contrato."
    />
  ),
});
