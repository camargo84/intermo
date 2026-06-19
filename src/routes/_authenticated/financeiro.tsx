import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Wallet, TrendingUp, FileSignature } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brl } from "@/lib/format";
import { listContracts } from "@/lib/contracts.functions";
import { getMyProfile } from "@/lib/profiles.functions";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Intermo" }] }),
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const fetchContracts = useServerFn(listContracts);
  const fetchProfile = useServerFn(getMyProfile);

  const { data: contractsData, isLoading } = useQuery({
    queryKey: ["financeiro-contracts"],
    queryFn: () => fetchContracts(),
  });
  const { data: profileData } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });

  const contracts = contractsData?.contracts ?? [];
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfYear = new Date(now.getFullYear(), 0, 1);

  const sumCents = (rows: typeof contracts) =>
    rows.reduce((acc, c) => acc + (((c as { value_cents?: number | null }).value_cents) ?? 0), 0);

  const signed = contracts.filter((c) => c.status === "signed");
  const monthSigned = signed.filter((c) => new Date(c.created_at) >= firstOfMonth);
  const yearSigned = signed.filter((c) => new Date(c.created_at) >= firstOfYear);

  const monthRevenue = sumCents(monthSigned) / 100;
  const yearRevenue = sumCents(yearSigned) / 100;
  const marginPct = Number(profileData?.profile?.default_margin_pct ?? 30);
  const monthMargin = (monthRevenue * marginPct) / 100;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Financeiro</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Receita calculada a partir dos contratos com status “assinado”. Margem de {marginPct.toFixed(0)}%
          configurável em Configurações.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receita do mês</CardTitle>
            <Wallet className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {isLoading ? "—" : brl(monthRevenue)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{monthSigned.length} contratos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Margem estimada (mês)</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-success">
              {isLoading ? "—" : brl(monthMargin)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{marginPct.toFixed(0)}% sobre receita</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Acumulado no ano</CardTitle>
            <FileSignature className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {isLoading ? "—" : brl(yearRevenue)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{yearSigned.length} contratos</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contratos assinados este mês</CardTitle>
        </CardHeader>
        <CardContent>
          {monthSigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum contrato assinado ainda neste mês.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {monthSigned.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{c.client_name}</p>
                  </div>
                  <span className="tabular-nums">
                    {brl(((c as { value_cents?: number | null }).value_cents ?? 0) / 100)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
