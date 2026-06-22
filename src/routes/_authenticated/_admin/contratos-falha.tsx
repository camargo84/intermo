import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listFailedContracts } from "@/lib/roles.functions";
import { resendContract } from "@/lib/contracts.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/_admin/contratos-falha")({
  component: FailedContractsPage,
});

function FailedContractsPage() {
  const fetchFailed = useServerFn(listFailedContracts);
  const resendFn = useServerFn(resendContract);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "failed-contracts"],
    queryFn: () => fetchFailed(),
  });
  const retry = useMutation({
    mutationFn: (contractId: string) => resendFn({ data: { contractId } }),
    onSuccess: () => {
      toast.success("Contrato reprocessado.");
      qc.invalidateQueries({ queryKey: ["admin", "failed-contracts"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const contracts = data?.contracts ?? [];

  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {isLoading ? "Carregando..." : `${contracts.length} contrato(s) com falha.`}
      </p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Título</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Erro</th>
              <th className="px-3 py-2">Criado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.id} className="border-t border-border align-top">
                <td className="px-3 py-2 font-medium">{c.title}</td>
                <td className="px-3 py-2">
                  <div>{c.client_name}</div>
                  <div className="text-xs text-muted-foreground">{c.client_email}</div>
                </td>
                <td className="px-3 py-2 text-xs text-destructive">{c.last_error ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleString("pt-BR")}
                </td>
                <td className="px-3 py-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={retry.isPending}
                    onClick={() => retry.mutate(c.id)}
                  >
                    Reprocessar
                  </Button>
                </td>
              </tr>
            ))}
            {contracts.length === 0 && !isLoading && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhum contrato com falha.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
