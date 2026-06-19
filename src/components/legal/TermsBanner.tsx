import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ScrollText } from "lucide-react";
import { getTermsStatus, acceptCurrentTerms } from "@/lib/terms.functions";

export function TermsBanner() {
  const fetchStatus = useServerFn(getTermsStatus);
  const acceptFn = useServerFn(acceptCurrentTerms);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["terms-status"],
    queryFn: () => fetchStatus(),
    staleTime: 60_000,
  });
  const accept = useMutation({
    mutationFn: () => acceptFn(),
    onSuccess: () => {
      toast.success("Termos aceitos.");
      qc.invalidateQueries({ queryKey: ["terms-status"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!data || data.uptodate) return null;

  return (
    <div
      role="alert"
      className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning-foreground"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <ScrollText className="h-4 w-4 shrink-0" />
        <p className="flex-1">
          Atualizamos os{" "}
          <Link to="/termos" className="underline">
            termos
          </Link>{" "}
          e a{" "}
          <Link to="/privacidade" className="underline">
            política de privacidade
          </Link>
          . Confirme pra continuar.
        </p>
        <button
          type="button"
          disabled={accept.isPending}
          onClick={() => accept.mutate()}
          className="rounded-md bg-warning px-3 py-1 text-xs font-medium text-warning-foreground hover:opacity-90 disabled:opacity-60"
        >
          {accept.isPending ? "..." : "Aceitar"}
        </button>
      </div>
    </div>
  );
}
