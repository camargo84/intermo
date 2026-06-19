import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getContract, resendContract } from "@/lib/contracts.functions";

export const Route = createFileRoute("/_authenticated/contratos/$contractId")({
  head: () => ({ meta: [{ title: "Detalhes do contrato — Intermo" }] }),
  component: ContractDetailsPage,
  errorComponent: ({ error, reset }) => {
    const isNotFound = error?.message === "NOT_FOUND";
    return (
      <div className="mx-auto w-full max-w-3xl p-6 text-center">
        <h1 className="mb-2 text-xl font-semibold">
          {isNotFound ? "Contrato não encontrado" : "Erro ao carregar"}
        </h1>
        <p className="mb-4 text-sm text-muted-foreground">
          {isNotFound
            ? "Esse contrato não existe ou não é seu."
            : (error?.message ?? "Tente novamente em instantes.")}
        </p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/contratos">Voltar</Link>
          </Button>
          {!isNotFound && <Button onClick={reset}>Tentar de novo</Button>}
        </div>
      </div>
    );
  },
});

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  signed: "Assinado",
  rejected: "Recusado",
  expired: "Expirado",
  error: "Erro",
};

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  signed: "default",
  sent: "secondary",
  draft: "outline",
  rejected: "destructive",
  expired: "destructive",
  error: "destructive",
};

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(cents: number | null | undefined) {
  if (cents == null) return null;
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

interface SignerView {
  public_id?: string | null;
  name?: string | null;
  email?: string | null;
  link?: string | null;
  signed_at?: string | null;
  rejected_at?: string | null;
}

function ContractDetailsPage() {
  const { contractId } = Route.useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fetchFn = useServerFn(getContract);
  const resendFn = useServerFn(resendContract);

  const { data, isLoading, error } = useQuery({
    queryKey: ["contract", contractId],
    queryFn: () => fetchFn({ data: { contractId } }),
  });

  const resendMut = useMutation({
    mutationFn: () => resendFn({ data: { contractId } }),
    onSuccess: () => {
      toast.success("Contrato reenviado pra Autentique.");
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      router.invalidate();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
    );
  }
  if (error || !data) {
    throw error ?? new Error("Falha ao carregar contrato");
  }

  const { contract, events } = data;
  const signers: SignerView[] = Array.isArray(contract.autentique_signers)
    ? (contract.autentique_signers as SignerView[])
    : [];
  const value = formatCurrency(contract.value_cents);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link to="/contratos">
            <ArrowLeft className="mr-1 h-4 w-4" /> Contratos
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {contract.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {contract.client_name} • {contract.client_email}
            </p>
          </div>
          <Badge variant={statusVariant[contract.status] ?? "secondary"}>
            {statusLabel[contract.status] ?? contract.status}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Info label="Criado em" value={formatDate(contract.created_at)} />
          <Info label="Enviado em" value={formatDate(contract.sent_at)} />
          <Info label="Assinado em" value={formatDate(contract.signed_at)} />
          {value && <Info label="Valor" value={value} />}
          {contract.client_doc && (
            <Info label="Documento" value={contract.client_doc} />
          )}
          {contract.autentique_document_id && (
            <Info
              label="ID Autentique"
              value={contract.autentique_document_id}
            />
          )}
        </CardContent>
      </Card>

      {contract.last_error && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertCircle className="h-4 w-4" /> Erro no envio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-destructive">{contract.last_error}</p>
            {contract.status === "error" && (
              <Button
                onClick={() => resendMut.mutate()}
                disabled={resendMut.isPending}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${
                    resendMut.isPending ? "animate-spin" : ""
                  }`}
                />
                {resendMut.isPending ? "Reenviando…" : "Reenviar pra Autentique"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assinantes</CardTitle>
        </CardHeader>
        <CardContent>
          {signers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum signatário ainda. Envie o contrato pra começar.
            </p>
          ) : (
            <ul className="divide-y">
              {signers.map((s, i) => (
                <li
                  key={s.public_id ?? s.email ?? i}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {s.name ?? s.email ?? "Signatário"}
                    </p>
                    {s.email && (
                      <p className="truncate text-xs text-muted-foreground">
                        {s.email}
                      </p>
                    )}
                    {s.signed_at && (
                      <p className="text-xs text-green-600">
                        Assinou em {formatDate(s.signed_at)}
                      </p>
                    )}
                    {s.rejected_at && (
                      <p className="text-xs text-destructive">
                        Recusou em {formatDate(s.rejected_at)}
                      </p>
                    )}
                  </div>
                  {s.link && (
                    <Button asChild size="sm" variant="outline">
                      <a href={s.link} target="_blank" rel="noreferrer">
                        Abrir link <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum evento registrado ainda.
            </p>
          ) : (
            <ol className="space-y-3">
              {events.map((ev, i) => (
                <li key={ev.id} className="flex gap-3">
                  <EventIcon type={ev.event_type} status={ev.status} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {humanizeEvent(ev.event_type)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(ev.created_at)}
                      {ev.signer_email ? ` • ${ev.signer_email}` : ""}
                    </p>
                    {ev.message && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ev.message}
                      </p>
                    )}
                  </div>
                  {i < events.length - 1 && <Separator className="hidden" />}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="break-all">{value}</p>
    </div>
  );
}

function EventIcon({
  type,
  status,
}: {
  type: string;
  status: string | null;
}) {
  const t = type.toLowerCase();
  const cls = "mt-0.5 h-4 w-4 shrink-0";
  if (t.includes("signed") || status === "signed")
    return <CheckCircle2 className={`${cls} text-green-600`} />;
  if (t.includes("rejected") || t.includes("failed") || status === "error")
    return <XCircle className={`${cls} text-destructive`} />;
  if (t.includes("expired"))
    return <AlertCircle className={`${cls} text-amber-600`} />;
  return <Clock className={`${cls} text-muted-foreground`} />;
}

function humanizeEvent(type: string): string {
  const map: Record<string, string> = {
    sent: "Documento enviado pra Autentique",
    send_failed: "Falha ao enviar pra Autentique",
    resend_requested: "Reenvio solicitado",
    "document.signed": "Documento totalmente assinado",
    "signature.signed": "Assinatura concluída",
    "signature.rejected": "Assinatura recusada",
    "document.rejected": "Documento recusado",
    "document.expired": "Documento expirado",
    "document.deleted": "Documento removido na Autentique",
  };
  return map[type] ?? type;
}
