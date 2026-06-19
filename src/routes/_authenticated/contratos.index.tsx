import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listContracts } from "@/lib/contracts.functions";

export const Route = createFileRoute("/_authenticated/contratos/")({
  head: () => ({ meta: [{ title: "Contratos — Intermo" }] }),
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
  const fetchFn = useServerFn(listContracts);
  const { data, isLoading, error } = useQuery({
    queryKey: ["contracts"],
    queryFn: () => fetchFn(),
  });

  const contracts = data?.contracts ?? [];

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

      {isLoading && (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      )}
      {error && (
        <p className="text-sm text-destructive">
          Não foi possível carregar os contratos.
        </p>
      )}

      {!isLoading && contracts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <FileText className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Nenhum contrato ainda</p>
          <p className="text-sm text-muted-foreground">
            Crie o primeiro e envie pra assinatura em minutos.
          </p>
        </div>
      )}

      <ul className="divide-y rounded-lg border">
        {contracts.map((c) => {
          const signers = Array.isArray(c.autentique_signers)
            ? (c.autentique_signers as Array<{ link?: string | null }>)
            : [];
          const link = signers[0]?.link ?? null;
          return (
            <li
              key={c.id}
              className="flex items-center justify-between gap-4 p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{c.title}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {c.client_name} • {c.client_email}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">
                  {statusLabel[c.status] ?? c.status}
                </Badge>
                {link && (
                  <Button asChild size="sm" variant="outline">
                    <a href={link} target="_blank" rel="noreferrer">
                      Abrir link
                    </a>
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
