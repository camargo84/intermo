import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  MessageSquare,
  PenLine,
  RefreshCw,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getContract,
  resendContract,
  sendContractToAutentique,
  deleteTransaction,
  checkProfileReadiness,
} from "@/lib/contracts.functions";
import { getContractPdfSignedUrl, getSignedContractPdfUrl } from "@/lib/agent.functions";
import { createSignatureToken, listSignatureTokens } from "@/lib/signature.functions";

export const Route = createFileRoute("/_authenticated/transacoes/$contractId")({
  head: () => ({ meta: [{ title: "Detalhes da transação — inTermo" }] }),
  component: ContractDetailsPage,
  errorComponent: ({ error, reset }) => {
    const isNotFound = error?.message === "NOT_FOUND";
    return (
      <div className="mx-auto w-full max-w-3xl p-6 text-center">
        <h1 className="mb-2 text-xl font-semibold">
          {isNotFound ? "Transação não encontrada" : "Erro ao carregar"}
        </h1>
        <p className="mb-4 text-sm text-muted-foreground">
          {isNotFound
            ? "Essa transação não existe ou não é sua."
            : (error?.message ?? "Tente novamente em instantes.")}
        </p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/transacoes">Voltar</Link>
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

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchFn = useServerFn(getContract);
  const resendFn = useServerFn(resendContract);
  const sendFn = useServerFn(sendContractToAutentique);
  const deleteFn = useServerFn(deleteTransaction);
  const checkProfileFn = useServerFn(checkProfileReadiness);
  const getPdfFn = useServerFn(getContractPdfSignedUrl);
  const getSignedPdfFn = useServerFn(getSignedContractPdfUrl);
  const createTokenFn = useServerFn(createSignatureToken);
  const listTokensFn = useServerFn(listSignatureTokens);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["contract", contractId],
    queryFn: () => fetchFn({ data: { contractId } }),
  });
  const { data: profileReady } = useQuery({
    queryKey: ["profile-readiness"],
    queryFn: () => checkProfileFn(),
  });
  const { data: tokensData, refetch: refetchTokens } = useQuery({
    queryKey: ["signature-tokens", contractId],
    queryFn: () => listTokensFn({ data: { contractId } }),
  });

  const generateLink = async (signerRole: "lojista" | "cliente") => {
    try {
      const result = await createTokenFn({ data: { contractId, signerRole } });
      const fullUrl = `${window.location.origin}${result.url}`;
      try {
        await navigator.clipboard.writeText(fullUrl);
        toast.success(
          `Link de ${signerRole} copiado. ${signerRole === "lojista" ? "Abra para assinar." : "Envie ao cliente."}`,
        );
      } catch {
        toast.success(`Link gerado: ${fullUrl}`);
      }
      if (signerRole === "lojista") {
        window.open(fullUrl, "_blank", "noopener");
      }
      refetchTokens();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const invalidateContract = () => {
    queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
    queryClient.invalidateQueries({ queryKey: ["contracts"] });
    router.invalidate();
  };

  const sendMut = useMutation({
    mutationFn: () => sendFn({ data: { contractId } }),
    onSuccess: () => {
      toast.success("Enviado para assinatura via Autentique.");
      invalidateContract();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : String(err));
    },
  });

  const resendMut = useMutation({
    mutationFn: () => resendFn({ data: { contractId } }),
    onSuccess: () => {
      toast.success("Contrato reenviado pra Autentique.");
      invalidateContract();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : String(err));
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteFn({ data: { contractId } }),
    onSuccess: () => {
      toast.success("Transação excluída.");
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["my-chat-threads"] });
      setConfirmDelete(false);
      navigate({ to: "/transacoes", search: { status: "all", q: "" } });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : String(err));
    },
  });

  async function handleDownload(signed: boolean) {
    setDownloading(true);
    try {
      const r = signed
        ? await getSignedPdfFn({ data: { contract_id: contractId } })
        : await getPdfFn({ data: { contract_id: contractId } });
      if (r.url) {
        window.open(r.url, "_blank");
      } else {
        toast.info(signed ? "PDF assinado ainda não disponível." : "PDF ainda não foi gerado.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
    );
  }
  if (error || !data) {
    throw error ?? new Error("Falha ao carregar transação");
  }

  const { contract, events } = data;
  const signers: SignerView[] = Array.isArray(contract.autentique_signers)
    ? (contract.autentique_signers as SignerView[])
    : [];
  const value = formatCurrency(contract.value_cents);

  const isDraft = contract.status === "draft";
  const isError = contract.status === "error";
  const canDelete = isDraft || isError;
  const canEdit = isDraft || isError;
  const isSigned = contract.status === "signed";
  const hasSignedPdf = Boolean(contract.signed_pdf_path);
  const hasPdf = Boolean(contract.pdf_path);

  // Razões pra desabilitar o "Enviar pra assinatura"
  const sendReasons: string[] = [];
  if (!isDraft) sendReasons.push("a transação já foi enviada.");
  if (!hasPdf) sendReasons.push("gere o contrato pelo chat antes de enviar.");
  if (!contract.client_name || contract.client_name.trim() === "—") {
    sendReasons.push("cadastre o cliente.");
  }
  if (!contract.client_email) sendReasons.push("informe o e-mail do cliente.");
  if (!contract.value_cents) sendReasons.push("informe o valor.");
  if (profileReady && !profileReady.ready) {
    sendReasons.push(`complete em Configurações: ${profileReady.missing.join(", ")}.`);
  }
  const canSend = sendReasons.length === 0;
  const sendDisabledReason = sendReasons.length > 0 ? sendReasons.join(" ") : "";

  return (
    <TooltipProvider>
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link to="/transacoes" search={{ status: "all", q: "" }}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Transações
            </Link>
          </Button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{contract.title}</h1>
              <p className="text-sm text-muted-foreground">
                {contract.client_name} • {contract.client_email}
              </p>
            </div>
            <Badge variant={statusVariant[contract.status] ?? "secondary"}>
              {statusLabel[contract.status] ?? contract.status}
            </Badge>
          </div>
        </div>

        {/* Barra de ações */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/40 p-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  onClick={() => sendMut.mutate()}
                  disabled={!canSend || sendMut.isPending}
                  size="sm"
                  title={!canSend ? `Não é possível enviar: ${sendDisabledReason}` : undefined}
                  aria-describedby={!canSend ? "send-disabled-reason" : undefined}
                >
                  {sendMut.isPending ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Enviar para assinatura
                </Button>
                {!canSend && (
                  <span id="send-disabled-reason" className="sr-only">
                    Não é possível enviar: {sendDisabledReason}
                  </span>
                )}
              </span>
            </TooltipTrigger>
            {!canSend && (
              <TooltipContent side="bottom" className="max-w-xs">
                {sendDisabledReason}
              </TooltipContent>
            )}
          </Tooltip>

          {hasPdf && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload(false)}
              disabled={downloading}
            >
              <Download className="mr-2 h-4 w-4" /> Baixar PDF
            </Button>
          )}
          {hasSignedPdf && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload(true)}
              disabled={downloading}
            >
              <Download className="mr-2 h-4 w-4" /> PDF assinado
            </Button>
          )}

          {canEdit && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/chat/$contractId" params={{ contractId }}>
                <MessageSquare className="mr-2 h-4 w-4" /> Editar pelo chat
              </Link>
            </Button>
          )}

          <div className="ml-auto">
            {canDelete && (
              <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir esta transação?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Essa ação não pode ser desfeita. A conversa e o rascunho serão removidos
                      permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleteMut.isPending}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        deleteMut.mutate();
                      }}
                      disabled={deleteMut.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleteMut.isPending ? "Excluindo…" : "Excluir"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
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
            {contract.client_doc && <Info label="Documento" value={contract.client_doc} />}
            {contract.autentique_document_id && (
              <Info label="ID Autentique" value={contract.autentique_document_id} />
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
              {isError && (
                <Button onClick={() => resendMut.mutate()} disabled={resendMut.isPending}>
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${resendMut.isPending ? "animate-spin" : ""}`}
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
                {isSigned
                  ? "Sem signatários registrados."
                  : "Nenhum signatário ainda. Use a ação \"Enviar para assinatura\" acima."}
              </p>
            ) : (
              <ul className="divide-y">
                {signers.map((s, i) => (
                  <li
                    key={s.public_id ?? s.email ?? i}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.name ?? s.email ?? "Signatário"}</p>
                      {s.email && <p className="truncate text-xs text-muted-foreground">{s.email}</p>}
                      {s.signed_at && (
                        <p className="text-xs text-green-600">Assinou em {formatDate(s.signed_at)}</p>
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
              <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
            ) : (
              <ol className="space-y-3">
                {events.map((ev, i) => (
                  <li key={ev.id} className="flex gap-3">
                    <EventIcon type={ev.event_type} status={ev.status} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{humanizeEvent(ev.event_type)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(ev.created_at)}
                        {ev.signer_email ? ` • ${ev.signer_email}` : ""}
                      </p>
                      {ev.message && (
                        <p className="mt-1 text-xs text-muted-foreground">{ev.message}</p>
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
    </TooltipProvider>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="break-all">{value}</p>
    </div>
  );
}

function EventIcon({ type, status }: { type: string; status: string | null }) {
  const t = type.toLowerCase();
  const cls = "mt-0.5 h-4 w-4 shrink-0";
  if (t.includes("signed") || status === "signed")
    return <CheckCircle2 className={`${cls} text-green-600`} />;
  if (t.includes("rejected") || t.includes("failed") || status === "error")
    return <XCircle className={`${cls} text-destructive`} />;
  if (t.includes("expired")) return <AlertCircle className={`${cls} text-amber-600`} />;
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
