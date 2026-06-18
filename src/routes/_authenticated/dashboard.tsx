import { createFileRoute } from "@tanstack/react-router";
import {
  FileText,
  AlertCircle,
  TrendingUp,
  PieChart,
  Receipt,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Intermo" }] }),
  component: DashboardPage,
});

const stats = [
  { icon: FileText, label: "Contratos no mês", value: "12", hint: "+3 esta semana", tone: "text-foreground" as const },
  { icon: AlertCircle, label: "Aguardando assinatura", value: "3", hint: "Acompanhe no chat", tone: "text-warning" as const },
  { icon: TrendingUp, label: "Margem acumulada", value: brl(8430.5), hint: "Mês atual", tone: "text-success" as const },
  { icon: Receipt, label: "DAS estimado", value: brl(412.18), hint: "Vence dia 20", tone: "text-info" as const },
];

const quotaUsed = 12;
const quotaLimit = 200;
const quotaPct = Math.min(100, Math.round((quotaUsed / quotaLimit) * 100));

function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Olá! 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aqui está como está o seu mês na Intermo.
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

      <section aria-label="Cota mensal">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <PieChart className="h-4 w-4 text-accent" />
                Cota mensal de contratos
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {quotaUsed} de {quotaLimit} contratos usados neste ciclo.
              </p>
            </div>
            <Badge variant="secondary" className="tabular-nums">
              {quotaPct}%
            </Badge>
          </CardHeader>
          <CardContent>
            <div
              className="h-3 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={quotaPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-700 ease-out"
                style={{ width: `${quotaPct}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Contratos excedentes custam {brl(1)} cada — sem surpresa no boleto.
            </p>
          </CardContent>
        </Card>
      </section>

      <section aria-label="Próximos passos" className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Comece um novo contrato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Nenhum contrato ainda. Comece uma conversa e crie o primeiro em minutos.</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Resumo financeiro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Receita do mês</span><span className="font-medium tabular-nums">{brl(34200)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Margem</span><span className="font-medium tabular-nums text-success">{brl(8430.5)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">A receber</span><span className="font-medium tabular-nums">{brl(5120)}</span></div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
