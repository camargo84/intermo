import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Loader2,
  ArrowUp,
  FileText,
  FileSignature,
  MessageCircle,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { supabase } from "@/integrations/supabase/client";
import { getChatThread, consolidateTransaction } from "@/lib/chat.functions";
import { createSignatureToken } from "@/lib/signature.functions";
import { getContractPdfSignedUrl, getSignedContractPdfUrl } from "@/lib/agent.functions";

export const Route = createFileRoute("/_authenticated/chat/$contractId")({
  head: () => ({ meta: [{ title: "Conversa — inTermo" }] }),
  component: ChatThreadPage,
});

type ContractSummary = {
  id: string;
  pdf_path: string | null;
  signed_pdf_path: string | null;
  status: string | null;
  title: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_paid_at?: string | null;
  supplier_paid_at?: string | null;
  freight_paid_at?: string | null;
  consolidated?: boolean | null;
};

function ChatThreadPage() {
  const { contractId } = useParams({ from: "/_authenticated/chat/$contractId" });
  const fetchThread = useServerFn(getChatThread);
  const getPdfUrl = useServerFn(getContractPdfSignedUrl);
  const getSignedPdfUrl = useServerFn(getSignedContractPdfUrl);

  const { data, isLoading } = useQuery({
    queryKey: ["chat-thread", contractId],
    queryFn: () => fetchThread({ data: { contractId } }),
  });

  const initialMessages = useMemo<UIMessage[]>(() => {
    try {
      return JSON.parse(data?.messagesJson ?? "[]");
    } catch {
      return [];
    }
  }, [data?.messagesJson]);

  const contract = (data?.contract ?? null) as ContractSummary | null;

  return isLoading ? (
    <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando conversa…
    </div>
  ) : (
    <ChatWindow
      key={contractId}
      contractId={contractId}
      initialMessages={initialMessages}
      contract={contract}
      onOpenPdf={async () => {
        const r = await getPdfUrl({ data: { contract_id: contractId } });
        if (r.url) window.open(r.url, "_blank");
        else toast.info("PDF ainda não foi gerado.");
      }}
      onOpenSignedPdf={async () => {
        const r = await getSignedPdfUrl({ data: { contract_id: contractId } });
        if (r.url) window.open(r.url, "_blank");
        else toast.info("PDF assinado ainda não está disponível.");
      }}
    />
  );
}

function ChatWindow({
  contractId,
  initialMessages,
  contract,
  onOpenPdf,
  onOpenSignedPdf,
}: {
  contractId: string;
  initialMessages: UIMessage[];
  contract: ContractSummary | null;
  onOpenPdf: () => Promise<void>;
  onOpenSignedPdf: () => Promise<void>;
}) {
  const [input, setInput] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSentRef = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          const t = data.session?.access_token;
          return t ? { Authorization: `Bearer ${t}` } : {};
        },
        body: { contractId },
      }),
    [contractId],
  );

  const { messages, sendMessage, status } = useChat({
    id: contractId,
    messages: initialMessages,
    transport,
    onError: (e) => toast.error("Erro no chat", { description: e.message }),
    onFinish: () => {
      queryClient.invalidateQueries({ queryKey: ["my-chat-threads"] });
      queryClient.invalidateQueries({ queryKey: ["chat-thread", contractId] });
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, contract?.pdf_path, contract?.signed_pdf_path]);

  useEffect(() => {
    if (status !== "streaming" && status !== "submitted") textareaRef.current?.focus();
  }, [status]);

  // Mensagem inicial vinda do /chat (empty state)
  useEffect(() => {
    if (autoSentRef.current || !token) return;
    if (initialMessages.length > 0) return;
    let initial: string | null = null;
    try {
      initial = sessionStorage.getItem(`chat:initial:${contractId}`);
      if (initial) sessionStorage.removeItem(`chat:initial:${contractId}`);
    } catch {
      /* ignore */
    }
    if (initial) {
      autoSentRef.current = true;
      void sendMessage({ text: initial });
    }
  }, [contractId, initialMessages.length, sendMessage, token]);

  const busy = status === "submitted" || status === "streaming";

  async function send() {
    const text = input.trim();
    if (!text || busy || !token) return;
    setInput("");
    await sendMessage({ text });
  }

  const fileBase = useMemo(() => {
    const raw = contract?.title
      ?.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const slug = raw?.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ?? "contrato";
    return slug.slice(0, 60) || "contrato";
  }, [contract?.title]);

  const consolidate = useServerFn(consolidateTransaction);
  const makeSignatureToken = useServerFn(createSignatureToken);
  const [consolidating, setConsolidating] = useState(false);

  async function handleConsolidate() {
    if (consolidating) return;
    setConsolidating(true);
    try {
      await consolidate({ data: { contractId } });
      toast.success("Transação consolidada.");
      queryClient.invalidateQueries({ queryKey: ["chat-thread", contractId] });
    } catch (e) {
      toast.error("Não foi possível consolidar", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      });
    } finally {
      setConsolidating(false);
    }
  }

  async function openWhatsapp() {
    const raw = (contract?.client_phone ?? "").replace(/\D/g, "");
    const phone = raw ? (raw.startsWith("55") ? raw : `55${raw}`) : "";
    const firstName = (contract?.client_name ?? "").split(" ")[0] || "tudo bem";
    try {
      const { url: path } = await makeSignatureToken({ data: { contractId } });
      const link = `${window.location.origin}${path}`;
      const text = encodeURIComponent(
        `Olá ${firstName}, seu contrato da inTermo está pronto! Para assinar, é só clicar aqui: ${link}. Qualquer dúvida, é só chamar.`,
      );
      const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
      window.open(url, "_blank");
    } catch (e) {
      toast.error("Não foi possível gerar o link de assinatura", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      });
    }
  }

  const contractSigned = Boolean(contract?.signed_pdf_path) || contract?.status === "signed";
  const clientPaid = Boolean(contract?.client_paid_at);
  const supplierPaid = Boolean(contract?.supplier_paid_at);
  const freightPaid = Boolean(contract?.freight_paid_at);
  const allDone = contractSigned && clientPaid && supplierPaid;
  const isConsolidated = Boolean(contract?.consolidated);

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] w-full max-w-3xl flex-col">
      <header className="border-b border-border/60 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-serif-display text-2xl text-foreground">Conversa</h1>
            <p className="text-xs text-muted-foreground">
              Descreva a venda em linguagem natural. O assistente cuida do resto.
            </p>
          </div>
          {(contract?.pdf_path || allDone) && (
            <div className="flex flex-wrap items-center gap-2">
              <ChecklistItem done={contractSigned} label="Contrato" />
              <ChecklistItem done={clientPaid} label="Pagto cliente" />
              <ChecklistItem done={supplierPaid} label="Pagto forn." />
              <ChecklistItem done={freightPaid} label="Frete" optional />
              {allDone && !isConsolidated && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleConsolidate}
                  disabled={consolidating}
                >
                  {consolidating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                  Consolidar transação
                </Button>
              )}
              {isConsolidated && (
                <span className="rounded-full bg-[color:var(--color-signal-mint)]/20 px-2 py-0.5 text-[10px] font-medium text-[color:var(--color-signal-mint)]">
                  Consolidada
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-6">
        {messages.length === 0 && !busy && (
          <p className="text-sm text-muted-foreground">
            Exemplo:{" "}
            <em className="text-foreground/80">
              "Quero formalizar um iPhone 15 Pro 256GB para Maria, CPF 123.456.789-09, por R$ 9.000
              à vista."
            </em>
          </p>
        )}
        <div className="space-y-6">
          {messages.map((m, idx) => (
            <MessageBlock
              key={m.id}
              message={m}
              isFirstAssistant={
                m.role === "assistant" && idx === messages.findIndex((x) => x.role === "assistant")
              }
            />
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Pensando…
            </div>
          )}
          {(contract?.pdf_path || contract?.signed_pdf_path) && !busy && (
            <div className="space-y-2">
              {contract?.pdf_path && (
                <ContractFileCard
                  label="Contrato gerado"
                  filename={`${fileBase}.pdf`}
                  variant="generated"
                  onOpen={onOpenPdf}
                  onWhatsapp={openWhatsapp}
                />
              )}
              {contract?.signed_pdf_path && (
                <ContractFileCard
                  label="Contrato assinado"
                  filename={`${fileBase}-assinado.pdf`}
                  variant="signed"
                  onOpen={onOpenSignedPdf}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border/60 pt-3">
        <div className="rounded-2xl border border-border bg-card/60 p-2 shadow-sm">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Escreva sua mensagem…"
            rows={2}
            className="resize-none border-0 bg-transparent px-2 py-1.5 text-sm shadow-none focus-visible:ring-0"
            disabled={!token}
          />
          <div className="flex items-center justify-end px-1 pb-1">
            <Button
              size="icon"
              onClick={() => void send()}
              disabled={busy || !token || !input.trim()}
              className="h-8 w-8 rounded-full"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowUp className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Quebra um texto da IA em (abertura curta serif-itálico-coral) + (resto).
 * Aplica somente quando a primeira frase tem até ~24 chars e termina com .,!,?
 * Ex.: "Boa tarde. Posso te ajudar..." → "Boa tarde." + " Posso te ajudar..."
 */
function splitOpener(text: string): { opener: string | null; rest: string } {
  const trimmed = text.trimStart();
  const match = trimmed.match(/^([^.!?\n]{1,24}[.!?])(\s+|$)/);
  if (!match) return { opener: null, rest: text };
  return { opener: match[1], rest: trimmed.slice(match[0].length) };
}

const TOOL_LABELS: Record<string, { running: string; done: string }> = {
  buscar_cliente: { running: "Buscando cliente…", done: "Cliente consultado" },
  consultar_cep: { running: "Consultando CEP…", done: "Endereço encontrado" },
  upsert_cliente: { running: "Salvando dados do cliente…", done: "Cliente salvo" },
  criar_contrato: { running: "Gerando contrato…", done: "Contrato gerado" },
  validate_cnpj: { running: "Validando CNPJ…", done: "CNPJ validado" },
};

function toolLabel(name: string, state?: string) {
  const entry = TOOL_LABELS[name];
  const isDone = state === "output-available" || state === "result";
  if (entry) return isDone ? entry.done : entry.running;
  return isDone ? "Concluído" : "Processando…";
}

/**
 * Protege CPF/CNPJ/telefones e outros números pontuados da formatação markdown.
 * Escapa `*` e `_` quando estão grudados em dígitos para que padrões como
 * `*123.456*.789-09` não sejam interpretados como ênfase e percam os dígitos.
 */
function sanitizeMarkdown(text: string): string {
  return text.replace(/(\d)([*_])/g, "$1\\$2").replace(/([*_])(\d)/g, "\\$1$2");
}

function MessageBlock({
  message,
  isFirstAssistant,
}: {
  message: UIMessage;
  isFirstAssistant: boolean;
}) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-[color:var(--color-signal-mint)] px-4 py-2 text-sm text-[color:var(--color-abyss)]">
          {message.parts.map((part, idx) =>
            part.type === "text" ? <div key={idx}>{part.text}</div> : null,
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-[95%] text-[15px] leading-relaxed text-foreground">
      {message.parts.map((part, idx) => {
        if (part.type === "text") {
          const safeText = sanitizeMarkdown(part.text);
          const isFirstTextPart =
            isFirstAssistant && idx === message.parts.findIndex((p) => p.type === "text");
          if (isFirstTextPart) {
            const { opener, rest } = splitOpener(safeText);
            if (opener) {
              return (
                <div
                  key={idx}
                  className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:font-serif-display"
                >
                  <p>
                    <span className="font-serif-display italic text-[color:var(--color-coral)]">
                      {opener}
                    </span>
                    {rest ? " " : ""}
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <>{children}</>,
                      }}
                    >
                      {rest}
                    </ReactMarkdown>
                  </p>
                </div>
              );
            }
          }
          return (
            <div
              key={idx}
              className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:font-serif-display"
            >
              <ReactMarkdown>{safeText}</ReactMarkdown>
            </div>
          );
        }
        if (part.type.startsWith("tool-")) {
          const toolName = part.type.replace("tool-", "");
          const state = (part as { state?: string }).state;
          const isDone = state === "output-available" || state === "result";
          return (
            <div
              key={idx}
              className="mt-2 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground"
            >
              {isDone ? (
                <CheckCircle2 className="h-3 w-3 text-[color:var(--color-signal-mint)]" />
              ) : (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              {toolLabel(toolName, state)}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

function ChecklistItem({
  done,
  label,
  optional,
}: {
  done: boolean;
  label: string;
  optional?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
        done
          ? "border-[color:var(--color-signal-mint)]/40 bg-[color:var(--color-signal-mint)]/10 text-[color:var(--color-signal-mint)]"
          : optional
            ? "border-border/60 text-muted-foreground/70"
            : "border-border text-muted-foreground"
      }`}
    >
      {done ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
      {label}
    </span>
  );
}

function ContractFileCard({
  label,
  filename,
  variant,
  onOpen,
  onWhatsapp,
}: {
  label: string;
  filename: string;
  variant: "generated" | "signed";
  onOpen: () => Promise<void>;
  onWhatsapp?: () => void;
}) {
  const Icon = variant === "signed" ? FileSignature : FileText;
  return (
    <div className="group flex w-full max-w-md items-center gap-3 rounded-xl border border-border/80 bg-card/50 px-4 py-3 transition hover:border-primary/40 hover:bg-card/80">
      <button
        type="button"
        onClick={() => void onOpen()}
        className="flex flex-1 items-center gap-3 text-left"
      >
        <Icon
          className={
            variant === "signed"
              ? "h-5 w-5 shrink-0 text-[color:var(--color-signal-mint)]"
              : "h-5 w-5 shrink-0 text-[color:var(--color-coral)]"
          }
        />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </div>
          <div className="truncate text-sm text-foreground group-hover:underline">{filename}</div>
        </div>
      </button>
      {onWhatsapp && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onWhatsapp();
          }}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366] transition hover:bg-[#25D366]/20"
          title="Enviar pelo WhatsApp"
          aria-label="Enviar pelo WhatsApp"
        >
          <MessageCircle className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
