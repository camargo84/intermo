import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  createAbacateCheckout,
  getMySubscription,
  cancelMySubscription,
} from "@/lib/subscriptions.functions";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/assinatura")({
  head: () => ({ meta: [{ title: "Assinatura — Intermo" }] }),
  component: AssinaturaPage,
});

function AssinaturaPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchSub = useServerFn(getMySubscription);
  const startCheckout = useServerFn(createAbacateCheckout);
  const cancelFn = useServerFn(cancelMySubscription);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => fetchSub(),
    refetchInterval: (q) => {
      const status = (q.state.data as { subscription?: { status?: string } } | undefined)?.subscription?.status;
      return status === "pending" ? 5000 : false;
    },
  });

  const sub = data?.subscription ?? null;
  const isActive = sub?.status === "active";

  async function handleStart() {
    setBusy(true);
    try {
      const { url } = await startCheckout();
      window.location.href = url;
    } catch (err) {
      toast.error("Não foi possível iniciar o pagamento", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!confirm("Cancelar a assinatura agora? Você perde acesso imediatamente.")) return;
    setBusy(true);
    try {
      await cancelFn();
      toast.success("Assinatura cancelada.");
      await queryClient.invalidateQueries({ queryKey: ["my-subscription"] });
      await refetch();
    } catch (err) {
      toast.error("Não consegui cancelar", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Assinatura Intermo</h1>
        <p className="text-sm text-muted-foreground">
          R$ 119/mês via AbacatePay (PIX ou cartão). 7 dias de garantia — se não gostar, devolvemos 100%.
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Status atual</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading ? "Carregando…" : statusDescription(sub?.status)}
            </p>
          </div>
          <StatusBadge status={sub?.status} />
        </CardHeader>
        <CardContent className="space-y-4">
          {sub?.current_period_end && (
            <div className="text-sm text-muted-foreground">
              Próxima cobrança em <strong className="text-foreground">{formatDate(sub.current_period_end)}</strong>.
            </div>
          )}
          {sub?.last_payment_at && (
            <div className="text-sm text-muted-foreground">
              Último pagamento em <strong className="text-foreground">{formatDate(sub.last_payment_at)}</strong>.
            </div>
          )}

          {isActive ? (
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigate({ to: "/dashboard" })}>Ir para o dashboard</Button>
              <Button variant="outline" onClick={handleCancel} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Cancelar assinatura
              </Button>
            </div>
          ) : (
            <Button size="lg" onClick={handleStart} disabled={busy} className="w-full sm:w-auto">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {sub?.status === "pending" ? "Continuar pagamento" : "Assinar por R$ 119/mês"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">O que está incluso</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-accent" />
              Até 200 contratos enviados por mês via Autentique
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-accent" />
              Geração automática do PDF e envio para assinatura
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-accent" />
              Painel de acompanhamento, financeiro e histórico
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-accent" />
              7 dias de garantia total — reembolso integral por e-mail
            </li>
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Valor cobrado: {brl(119)} por mês. Para pedir reembolso nos 7 primeiros dias, escreva pra
            ajuda@intermo.com.br.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    active: { label: "Ativa", variant: "default" },
    pending: { label: "Aguardando pagamento", variant: "secondary" },
    past_due: { label: "Em atraso", variant: "destructive" },
    canceled: { label: "Cancelada", variant: "outline" },
    refunded: { label: "Reembolsada", variant: "outline" },
  };
  const cfg = status ? map[status] : null;
  if (!cfg) return <Badge variant="outline">Sem assinatura</Badge>;
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function statusDescription(status?: string) {
  switch (status) {
    case "active":
      return "Tudo certo — sua conta está liberada.";
    case "pending":
      return "Estamos esperando a confirmação do pagamento. Pode levar alguns segundos.";
    case "past_due":
      return "A última cobrança falhou. Atualize o pagamento pra não perder acesso.";
    case "canceled":
      return "Sua assinatura está cancelada. Reative quando quiser.";
    case "refunded":
      return "Pedido de reembolso processado.";
    default:
      return "Você ainda não assinou. Comece em menos de 2 minutos.";
  }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}
