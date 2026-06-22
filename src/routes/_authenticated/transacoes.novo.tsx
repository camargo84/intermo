import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createContract,
  sendContractToAutentique,
} from "@/lib/contracts.functions";

export const Route = createFileRoute("/_authenticated/transacoes/novo")({
  head: () => ({ meta: [{ title: "Novo contrato — inTermo" }] }),
  component: NovoContratoPage,
});

function NovoContratoPage() {
  const navigate = useNavigate();
  const createFn = useServerFn(createContract);
  const sendFn = useServerFn(sendContractToAutentique);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const valueStr = String(fd.get("value") ?? "").replace(/\D/g, "");
    setBusy(true);
    try {
      const { id } = await createFn({
        data: {
          title: String(fd.get("title") ?? ""),
          content: String(fd.get("content") ?? ""),
          clientName: String(fd.get("clientName") ?? ""),
          clientEmail: String(fd.get("clientEmail") ?? ""),
          clientDoc: String(fd.get("clientDoc") ?? "") || null,
          valueCents: valueStr ? Number(valueStr) : null,
        },
      });
      const result = await sendFn({ data: { contractId: id } });
      const link = result.signers[0]?.link;
      toast.success("Contrato enviado pra assinatura", {
        description: link ? `Link: ${link}` : "Verifique o email do cliente.",
      });
      navigate({ to: "/transacoes" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      toast.error("Não foi possível enviar", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Novo contrato</h1>
        <p className="text-sm text-muted-foreground">
          Preencha os dados e envie pra assinatura digital via Autentique.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Título</Label>
          <Input id="title" name="title" required maxLength={200} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="clientName">Nome do cliente</Label>
            <Input id="clientName" name="clientName" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientEmail">Email do cliente</Label>
            <Input id="clientEmail" name="clientEmail" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientDoc">CPF/CNPJ (opcional)</Label>
            <Input id="clientDoc" name="clientDoc" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="value">Valor em R$ (opcional)</Label>
            <Input id="value" name="value" inputMode="numeric" placeholder="0,00" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">Objeto do contrato</Label>
          <Textarea id="content" name="content" required rows={10} />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate({ to: "/transacoes" })}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Enviando…" : "Enviar pra assinatura"}
          </Button>
        </div>
      </form>
    </div>
  );
}
