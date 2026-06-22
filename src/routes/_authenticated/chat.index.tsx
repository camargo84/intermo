import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { Loader2, ArrowRight, FilePlus2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createDraftContractForChat } from "@/lib/chat.functions";
import { IntermoMark } from "@/components/brand/IntermoMark";

export const Route = createFileRoute("/_authenticated/chat/")({
  head: () => ({ meta: [{ title: "Chat com IA — inTermo" }] }),
  component: ChatEntryPage,
});

const STARTER_PROMPT = "Quero criar uma nova transação.";

function ChatEntryPage() {
  const navigate = useNavigate();
  const create = useServerFn(createDraftContractForChat);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function start(prompt: string) {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    try {
      const { contractId } = await create();
      try {
        sessionStorage.setItem(`chat:initial:${contractId}`, prompt.trim());
      } catch {
        /* ignore */
      }
      navigate({ to: "/chat/$contractId", params: { contractId } });
    } catch (err) {
      setBusy(false);
      toast.error("Não consegui abrir uma nova conversa", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-10rem)] w-full max-w-3xl flex-col items-center justify-center gap-10 px-4 py-12">
      <div className="text-center">
        <p className="eyebrow mb-3 inline-flex items-center gap-1.5 text-primary/80">
          <IntermoMark variant="plain" className="h-3.5 w-3.5 text-primary/80" /> inTermo
        </p>
        <h1 className="font-serif-display text-4xl leading-tight text-foreground sm:text-5xl md:text-6xl">
          Da conversa ao contrato,
          <br />
          <span className="italic text-[color:var(--color-coral)]">sem fricção.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
          Descreva a venda em linguagem natural. O assistente cuida do cadastro, do contrato e da
          assinatura digital.
        </p>
      </div>

      <div className="w-full">
        <div className="rounded-2xl border border-border bg-card/60 p-3 shadow-sm backdrop-blur">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void start(input);
              }
            }}
            placeholder="Conte o que você precisa contratar…"
            rows={3}
            disabled={busy}
            className="resize-none border-0 bg-transparent px-3 py-2 text-base shadow-none focus-visible:ring-0"
          />
          <div className="flex items-center justify-between px-1 pb-1 pt-2">
            <span className="text-xs text-muted-foreground">
              Enter envia · Shift+Enter quebra linha
            </span>
            <Button
              size="sm"
              onClick={() => void start(input)}
              disabled={busy || !input.trim()}
              className="gap-1"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" />
              )}
              Nova transação
            </Button>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => void start(STARTER.prompt)}
            disabled={busy}
            className="group flex max-w-md items-start gap-3 rounded-xl border border-border bg-card/40 p-4 text-left transition hover:border-primary/40 hover:bg-card/80 disabled:opacity-60"
          >
            <STARTER.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <div className="text-sm font-medium text-foreground">{STARTER.title}</div>
              <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {STARTER.prompt}
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
