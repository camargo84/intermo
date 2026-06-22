import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Wallet, TrendingUp, FileSignature, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { brl } from "@/lib/format";
import { getMyProfile } from "@/lib/profiles.functions";
import { listFinanceiroMonth, exportFinanceiroXlsx } from "@/lib/financeiro.functions";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — inTermo" }] }),
  component: FinanceiroPage,
});

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function FinanceiroPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [exporting, setExporting] = useState(false);

  const fetchMonth = useServerFn(listFinanceiroMonth);
  const fetchProfile = useServerFn(getMyProfile);
  const exportXlsx = useServerFn(exportFinanceiroXlsx);

  const { data, isLoading } = useQuery({
    queryKey: ["financeiro-month", year, month],
    queryFn: () => fetchMonth({ data: { year, month } }),
  });
  const { data: profileData } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });

  const rows = data?.rows ?? [];
  const signed = rows.filter((r) => r.status === "signed");
  const open = rows.filter((r) => r.status !== "signed");

  const sumCents = (arr: typeof rows, key: keyof (typeof rows)[number]) =>
    arr.reduce((acc, r) => acc + ((r[key] as number | null) ?? 0), 0);

  const monthRevenue = sumCents(signed, "value_cents") / 100;
  const openTotal = sumCents(open, "value_cents") / 100;
  const marginPct = Number(profileData?.profile?.default_margin_pct ?? 30);
  const monthMargin = (monthRevenue * marginPct) / 100;
  const consolidated = rows.filter((r) => r.consolidated).length;

  const yearOptions = useMemo(() => {
    return [year - 2, year - 1, year, year + 1];
  }, [year]);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const r = await exportXlsx({ data: { year, month } });
      const bin = atob(r.base64);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const blob = new Blob([u8 as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Não foi possível exportar", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Financeiro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Receita por mês a partir das transações assinadas. Margem de {marginPct.toFixed(0)}%
            configurável em Configurações.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleExport} disabled={exporting || rows.length === 0}>
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Exportar XLSX
          </Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receita do mês
            </CardTitle>
            <Wallet className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {isLoading ? "—" : brl(monthRevenue)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {signed.length} contratos assinados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Margem estimada
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-success">
              {isLoading ? "—" : brl(monthMargin)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {marginPct.toFixed(0)}% sobre receita
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Consolidadas
            </CardTitle>
            <FileSignature className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {isLoading ? "—" : `${consolidated}/${rows.length}`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">transações fechadas</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Assinadas em {MONTHS[month - 1]}/{year}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Compõem a receita do mês. Total: {brl(monthRevenue)}.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : signed.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma transação assinada neste mês.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {signed.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.client_name} · Assinada
                      {c.consolidated ? " · consolidada" : ""}
                    </p>
                  </div>
                  <span className="tabular-nums">
                    {brl(((c.value_cents as number | null) ?? 0) / 100)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Em aberto em {MONTHS[month - 1]}/{year}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Rascunhos e enviadas — não entram na receita. Potencial: {brl(openTotal)}.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : open.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma transação em aberto neste mês.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {open.map((c) => {
                const statusPt =
                  c.status === "draft"
                    ? "Rascunho"
                    : c.status === "sent"
                      ? "Enviada"
                      : c.status === "error"
                        ? "Erro"
                        : c.status === "rejected"
                          ? "Recusada"
                          : c.status === "expired"
                            ? "Expirada"
                            : c.status;
                return (
                  <li key={c.id} className="flex items-center justify-between py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.client_name} · {statusPt}
                      </p>
                    </div>
                    <span className="tabular-nums text-muted-foreground">
                      {brl(((c.value_cents as number | null) ?? 0) / 100)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
