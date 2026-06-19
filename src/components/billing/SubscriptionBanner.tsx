import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { getMySubscription } from "@/lib/subscriptions.functions";

export function SubscriptionBanner() {
  const fetchSub = useServerFn(getMySubscription);
  const { data } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => fetchSub(),
    staleTime: 30_000,
  });
  const status = data?.subscription?.status;
  if (status === "active") return null;

  const message =
    status === "past_due"
      ? "Sua última cobrança falhou. Regularize pra continuar emitindo contratos."
      : status === "pending"
        ? "Estamos aguardando a confirmação do seu pagamento."
        : status === "canceled" || status === "refunded"
          ? "Sua assinatura está inativa. Reative pra voltar a emitir contratos."
          : "Você ainda não tem uma assinatura ativa. Assine pra liberar o sistema.";

  return (
    <div
      role="alert"
      className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning-foreground"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <p className="flex-1">{message}</p>
        <Link
          to="/assinatura"
          className="rounded-md bg-warning px-3 py-1 text-xs font-medium text-warning-foreground hover:opacity-90"
        >
          Ver assinatura
        </Link>
      </div>
    </div>
  );
}
