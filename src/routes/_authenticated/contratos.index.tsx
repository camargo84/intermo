import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { FileText, Plus, AlertCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listContracts } from "@/lib/contracts.functions";

const statusValues = [
  "all",
  "draft",
  "sent",
  "signed",
  "rejected",
  "expired",
  "error",
] as const;

const searchSchema = z.object({
  status: fallback(z.enum(statusValues), "all").default("all"),
  q: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/contratos/")({
  head: () => ({ meta: [{ title: "Contratos — Intermo" }] }),
  validateSearch: zodValidator(searchSchema),
  component: ContratosPage,
});

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  signed: "Assinado",
  rejected: "Recusado",
  expired: "Expirado",
  error: "Erro",
};

function ContratosPage() {
  const { status, q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const fetchFn = useServerFn(listContracts);
  const { data, isLoading, error } = useQuery({
    queryKey: ["contracts"],
    queryFn: () => fetchFn(),
  });

  const contracts = data?.contracts ?? [];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return contracts.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (!needle) return true;
      return (
        c.title.toLowerCase().includes(needle) ||
        c.client_name.toLowerCase().includes(needle) ||
        c.client_email.toLowerCase().includes(needle)
      );
    });
  }, [contracts, status, q]);

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contratos</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe os contratos enviados pra assinatura.
          </p>
        </div>
        <Button asChild>
          <Link to="/contratos/novo">
            <Plus className="mr-2 h-4 w-4" /> Novo contrato
          </Link>
        </Button>
      </header>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) =>
              navigate({
                search: (prev) => ({ ...prev, q: e.target.value }),
                replace: true,
              })
            }
            placeholder="Buscar por título, cliente ou e-mail…"
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) =>
            navigate({
              search: (prev) => ({
                ...prev,
                status: value as (typeof statusValues)[number],
              }),
              replace: true,
            })
          }
        >
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {statusValues
              .filter((s) => s !== "all")
              .map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel[s] ?? s}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      )}
      {error && (
        <p className="text-sm text-destructive">
          Não foi possível carregar os contratos.
        </p>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <FileText className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">
            {contracts.length === 0
              ? "Nenhum contrato ainda"
              : "Nenhum contrato com esses filtros"}
          </p>
          <p className="text-sm text-muted-foreground">
            {contracts.length === 0
              ? "Crie o primeiro e envie pra assinatura em minutos."
              : "Tente outro status ou termo de busca."}
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {filtered.map((c) => {
            const signedAt = c.signed_at
              ? new Date(c.signed_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null;
            return (
              <li key={c.id}>
                <Link
                  to="/contratos/$contractId"
                  params={{ contractId: c.id }}
                  className="flex flex-col gap-2 p-4 transition hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {c.client_name} • {c.client_email}
                    </p>
                    {signedAt && (
                      <p className="text-xs text-green-600">
                        Assinado em {signedAt}
                      </p>
                    )}
                    {c.last_error && (
                      <p className="flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        {c.last_error}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary">
                    {statusLabel[c.status] ?? c.status}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
