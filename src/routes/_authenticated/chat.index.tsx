import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { createDraftContractForChat } from "@/lib/chat.functions";

export const Route = createFileRoute("/_authenticated/chat/")({
  head: () => ({ meta: [{ title: "Chat com IA — inTermo" }] }),
  component: ChatEntryPage,
});

function ChatEntryPage() {
  const navigate = useNavigate();
  const create = useServerFn(createDraftContractForChat);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    create()
      .then(({ contractId }) => navigate({ to: "/chat/$contractId", params: { contractId } }))
      .catch(() => navigate({ to: "/contratos" }));
  }, [create, navigate]);

  return (
    <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Abrindo nova conversa…
    </div>
  );
}
