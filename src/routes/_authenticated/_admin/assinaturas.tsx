import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllSubscriptions } from "@/lib/roles.functions";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/_admin/assinaturas")({
  component: AdminSubscriptionsPage,
});

function AdminSubscriptionsPage() {
  const fetchAll = useServerFn(listAllSubscriptions);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "subscriptions"],
    queryFn: () => fetchAll(),
  });

  const subs = data?.subscriptions ?? [];
  const counts = subs.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {["active", "pending", "past_due", "canceled", "refunded"].map((status) => (
          <div key={status} className="rounded-md border border-border p-3">
            <div className="text-xs uppercase text-muted-foreground">{status}</div>
            <div className="text-2xl font-semibold">{counts[status] ?? 0}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Usuário</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Valor</th>
              <th className="px-3 py-2">Quota</th>
              <th className="px-3 py-2">Último pagto</th>
              <th className="px-3 py-2">Próx. cobrança</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.user_id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{s.user_id.slice(0, 8)}…</td>
                <td className="px-3 py-2">{s.status}</td>
                <td className="px-3 py-2">{brl((s.amount_cents ?? 0) / 100)}</td>
                <td className="px-3 py-2">{s.monthly_contract_quota}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {s.last_payment_at ? new Date(s.last_payment_at).toLocaleString("pt-BR") : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {s.current_period_end ? new Date(s.current_period_end).toLocaleString("pt-BR") : "—"}
                </td>
              </tr>
            ))}
            {subs.length === 0 && !isLoading && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhuma assinatura.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
