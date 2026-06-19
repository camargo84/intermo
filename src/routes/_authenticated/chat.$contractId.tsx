import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, ArrowUp, Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getChatThread } from "@/lib/chat.functions";
import { getContractPdfSignedUrl } from "@/lib/agent.functions";

export const Route = createFileRoute("/_authenticated/chat/$contractId")({
  head: () => ({ meta: [{ title: "Conversa — inTermo" }] }),
  component: ChatThreadPage,
});

function ChatThreadPage() {
  const { contractId } = useParams({ from: "/_authenticated/chat/$contractId" });
  const fetchThread = useServerFn(getChatThread);
  const getPdfUrl = useServerFn(getContractPdfSignedUrl);

  const { data, isLoading } = useQuery({
    queryKey: ["chat-thread", contractId],
    queryFn: () => fetchThread({ data: { contractId } }),
  });

  const initialMessages = useMemo<UIMessage[]>(() => {
    try { return JSON.parse(data?.messagesJson ?? "[]"); } catch { return []; }
  }, [data?.messagesJson]);

  return isLoading ? (
    <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando conversa…
    </div>
  ) : (
    <ChatWindow
      key={contractId}
      contractId={contractId}
      initialMessages={initialMessages}
      pdfReady={Boolean(data?.contract?.pdf_path)}
      onGetPdf={async () => {
        const r = await getPdfUrl({ data: { contract_id: contractId } });
        if (r.url) window.open(r.url, "_blank");
        else toast.info("PDF ainda não foi gerado.");
      }}
    />
  );
}

function ChatWindow({
  contractId,
  initialMessages,
  pdfReady,
  onGetPdf,
}: {
  contractId: string;
  initialMessages: UIMessage[];
  pdfReady: boolean;
  onGetPdf: () => Promise<void>;
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
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

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
    } catch { /* ignore */ }
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

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] w-full max-w-3xl flex-col">
      <header className="flex items-center justify-between border-b border-border/60 pb-4">
        <div>
          <h1 className="font-serif-display text-2xl text-foreground">Conversa</h1>
          <p className="text-xs text-muted-foreground">
            Descreva a venda em linguagem natural. O assistente cuida do resto.
          </p>
        </div>
        {pdfReady && (
          <Button variant="outline" size="sm" onClick={onGetPdf}>
            <Download className="mr-2 h-4 w-4" /> Baixar PDF
          </Button>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-6">
        {messages.length === 0 && !busy && (
          <p className="text-sm text-muted-foreground">
            Exemplo: <em className="text-foreground/80">"Quero formalizar um iPhone 15 Pro 256GB
            para Maria, CPF 123.456.789-09, por R$ 9.000 à vista."</em>
          </p>
        )}
        <div className="space-y-6">
          {messages.map((m) => (
            <MessageBlock key={m.id} message={m} />
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Pensando…
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
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
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
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBlock({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
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
          return (
            <div key={idx} className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:font-serif-display">
              <ReactMarkdown>{part.text}</ReactMarkdown>
            </div>
          );
        }
        if (part.type.startsWith("tool-")) {
          const toolName = part.type.replace("tool-", "");
          return (
            <Badge key={idx} variant="secondary" className="mt-2 mr-1 text-[10px]">
              ferramenta: {toolName}
            </Badge>
          );
        }
        return null;
      })}
    </div>
  );
}
