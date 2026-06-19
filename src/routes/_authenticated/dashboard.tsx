import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  AlertCircle,
  TrendingUp,
  PieChart,
  CreditCard,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import { listContracts } from "@/lib/contracts.functions";
import { getMyMonthlyQuota } from "@/lib/quota.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — inTermo" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const fetchContracts = useServerFn(listContracts);
  const fetchQuota = useServerFn(getMyMonthlyQuota);

  const { data: contractsData } = useQuery({
    queryKey: ["dashboard-contracts"],
    queryFn: () => fetchContracts(),
  });
  const { data: quotaData } = useQuery({
    queryKey: ["my-quota"],
    queryFn: () => fetchQuota(),
  });

  const contracts = contractsData?.contracts ?? [];
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthContracts = contracts.filter((c) => new Date(c.created_at) >= firstOfMonth);
  const awaiting = contracts.filter((c) => c.status === "sent").length;
  const signedThisMonth = monthContracts.filter((c) => c.status === "signed");
  const revenueCents = signedThisMonth.reduce(
    (acc, c) => acc + (typeof (c as { value_cents?: number }).value_cents === "number" ? ((c as { value_cents?: number }).value_cents ?? 0) : 0),
    0,
  );

  const quotaUsed = quotaData?.used ?? monthContracts.length;


  const stats = [
    { icon: FileText, label: "Contratos no mês", value: String(monthContracts.length), hint: "Inclui rascunhos", tone: "text-foreground" as const },
    { icon: AlertCircle, label: "Aguardando assinatura", value: String(awaiting), hint: "Acompanhe em Contratos", tone: "text-warning" as const },
    { icon: TrendingUp, label: "Receita do mês", value: brl(revenueCents / 100), hint: "Contratos assinados", tone: "text-success" as const },
    { icon: CreditCard, label: "Plano", value: quotaData?.hasActiveSubscription ? "Ativo" : "Inativo", hint: "R$ 119/mês", tone: "text-info" as const },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Olá! 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aqui está como está o seu mês na inTermo.
        </p>
      </header>

      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.tone}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section aria-label="Resumo do mês">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <PieChart className="h-4 w-4 text-accent" />
                Contratos no mês
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {quotaUsed} {quotaUsed === 1 ? "contrato emitido" : "contratos emitidos"} neste mês.
              </p>
            </div>
            <Badge variant="secondary" className="tabular-nums">
              {quotaUsed}
            </Badge>
          </CardHeader>
        </Card>
      </section>


      <section aria-label="Próximos passos" className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Comece um novo contrato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Crie e envie em minutos pra assinatura via Autentique.</p>
            <Link to="/contratos/novo" className="text-accent hover:underline">
              Criar contrato →
            </Link>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Resumo financeiro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Receita do mês</span>
              <span className="font-medium tabular-nums">{brl(revenueCents / 100)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contratos assinados</span>
              <span className="font-medium tabular-nums text-success">{signedThisMonth.length}</span>
            </div>
            <div className="pt-2">
              <Link to="/financeiro" className="text-accent hover:underline">
                Ver detalhes →
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
