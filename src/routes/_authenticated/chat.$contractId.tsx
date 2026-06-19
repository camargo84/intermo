import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, Send, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getChatThread } from "@/lib/chat.functions";
import { getContractPdfSignedUrl } from "@/lib/agent.functions";

export const Route = createFileRoute("/_authenticated/chat/$contractId")({
  head: () => ({ meta: [{ title: "Chat com IA — inTermo" }] }),
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
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (status !== "streaming" && status !== "submitted") textareaRef.current?.focus();
  }, [status]);

  const busy = status === "submitted" || status === "streaming";

  async function send() {
    const text = input.trim();
    if (!text || busy || !token) return;
    setInput("");
    await sendMessage({ text });
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] w-full max-w-3xl flex-col gap-3">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Sparkles className="h-5 w-5 text-primary" /> Chat com IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Descreva a venda em linguagem natural. O assistente cuida do cadastro e do contrato.
          </p>
        </div>
        {pdfReady && (
          <Button variant="outline" size="sm" onClick={onGetPdf}>
            <Download className="mr-2 h-4 w-4" /> Baixar PDF
          </Button>
        )}
      </header>

      <Card className="flex-1 overflow-hidden">
        <div ref={scrollRef} className="h-full overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Exemplo: <em>"Quero vender um iPhone 15 Pro 256GB para Maria, CPF 123.456.789-09, por R$ 9.000 à vista."</em>
            </p>
          )}
          <div className="space-y-4">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Pensando…
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="flex gap-2">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
          }}
          placeholder="Escreva sua mensagem…"
          rows={2}
          className="resize-none"
          disabled={!token}
        />
        <Button onClick={() => void send()} disabled={busy || !token || !input.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {message.parts.map((part, idx) => {
          if (part.type === "text") {
            return (
              <div key={idx} className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{part.text}</ReactMarkdown>
              </div>
            );
          }
          if (part.type.startsWith("tool-")) {
            const toolName = part.type.replace("tool-", "");
            return (
              <Badge key={idx} variant="secondary" className="mt-1">
                ferramenta: {toolName}
              </Badge>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
