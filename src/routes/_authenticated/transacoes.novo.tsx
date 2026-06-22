import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { criarContrato, gerarPdfContrato } from "@/lib/agent.functions";
import { sendContractToAutentique } from "@/lib/contracts.functions";
import { searchClient, upsertClient } from "@/lib/clients.functions";
import { onlyDigits, validateCPF, validateCNPJ } from "@/lib/validators";

export const Route = createFileRoute("/_authenticated/transacoes/novo")({
  head: () => ({ meta: [{ title: "Nova transação — inTermo" }] }),
  component: NovaTransacaoPage,
});

type Produto = { descricao: string; quantidade: number; preco_brl: string };
type ClienteSel = { id: string; name: string } | null;

// BRL → cents
function brlToCents(s: string): number {
  const cleaned = s.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function NovaTransacaoPage() {
  const navigate = useNavigate();
  const criar = useServerFn(criarContrato);
  const gerarPdf = useServerFn(gerarPdfContrato);
  const enviar = useServerFn(sendContractToAutentique);
  const buscar = useServerFn(searchClient);
  const upsert = useServerFn(upsertClient);

  const [busy, setBusy] = useState(false);
  const [cliente, setCliente] = useState<ClienteSel>(null);

  // Busca/criação de cliente
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState<
    Array<{ id: string; name: string; cpf: string | null; cnpj: string | null }>
  >([]);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDoc, setNewDoc] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // Produtos
  const [produtos, setProdutos] = useState<Produto[]>([
    { descricao: "", quantidade: 1, preco_brl: "" },
  ]);

  // Pagamento
  const [forma, setForma] = useState<"avista" | "parcelado" | "misto">("avista");
  const [entradaBrl, setEntradaBrl] = useState("");
  const [parcelas, setParcelas] = useState<number>(1);

  const valorCents = useMemo(
    () => produtos.reduce((acc, p) => acc + p.quantidade * brlToCents(p.preco_brl), 0),
    [produtos],
  );
  const valorBrl = (valorCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  async function doSearch() {
    if (clientQuery.trim().length < 2) return;
    try {
      const r = await buscar({ data: { query: clientQuery.trim() } });
      setClientResults(r.clients);
      if (r.clients.length === 0) setShowNewClient(true);
    } catch (e) {
      toast.error("Erro na busca", { description: (e as Error).message });
    }
  }

  async function createClient() {
    const digits = onlyDigits(newDoc);
    const isCpf = digits.length === 11;
    const isCnpj = digits.length === 14;
    if (!isCpf && !isCnpj) return toast.error("Informe um CPF (11) ou CNPJ (14) válido.");
    if (isCpf && !validateCPF(digits)) return toast.error("CPF inválido.");
    if (isCnpj && !validateCNPJ(digits)) return toast.error("CNPJ inválido.");
    if (newName.trim().length < 2) return toast.error("Informe o nome do cliente.");
    try {
      const r = await upsert({
        data: {
          name: newName.trim(),
          cpf: isCpf ? digits : null,
          cnpj: isCnpj ? digits : null,
          email: newEmail.trim() || null,
          phone: newPhone.trim() || null,
        },
      });
      setCliente({ id: r.id, name: newName.trim() });
      setShowNewClient(false);
      toast.success(r.created ? "Cliente criado" : "Cliente atualizado");
    } catch (e) {
      toast.error("Erro ao salvar cliente", { description: (e as Error).message });
    }
  }

  function updateProduto(i: number, patch: Partial<Produto>) {
    setProdutos((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function addProduto() {
    setProdutos((prev) => [...prev, { descricao: "", quantidade: 1, preco_brl: "" }]);
  }
  function removeProduto(i: number) {
    setProdutos((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cliente) return toast.error("Selecione um cliente.");
    if (valorCents <= 0) return toast.error("Informe ao menos um produto com preço.");
    const produtosPayload = produtos
      .filter((p) => p.descricao.trim() && brlToCents(p.preco_brl) > 0 && p.quantidade > 0)
      .map((p) => ({
        descricao: p.descricao.trim(),
        quantidade: p.quantidade,
        preco_unit_cents: brlToCents(p.preco_brl),
      }));
    if (produtosPayload.length === 0) return toast.error("Produtos inválidos.");
    const entradaCents = forma === "misto" ? brlToCents(entradaBrl) : 0;
    if (forma === "misto" && (entradaCents <= 0 || entradaCents >= valorCents)) {
      return toast.error("Entrada deve ser > 0 e < valor total.");
    }

    setBusy(true);
    try {
      const { id } = await criar({
        data: {
          client_id: cliente.id,
          produtos: produtosPayload,
          valor_cents: valorCents,
          forma_pagamento: forma,
          entrada_cents: entradaCents,
          parcelas: forma === "parcelado" || forma === "misto" ? parcelas : null,
        },
      });
      await gerarPdf({
        data: {
          contract_id: id,
          parcelas: forma === "parcelado" || forma === "misto" ? parcelas : null,
        },
      });
      const result = await enviar({ data: { contractId: id } });
      const link = result.signers[0]?.link;
      toast.success("Transação enviada para assinatura", {
        description: link ? `Link: ${link}` : "Verifique o email do cliente.",
      });
      navigate({ to: "/transacoes/$contractId", params: { contractId: id } });
    } catch (err) {
      toast.error("Não foi possível enviar", {
        description: err instanceof Error ? err.message : "Erro inesperado",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Nova transação</h1>
        <p className="text-sm text-muted-foreground">
          Modo avançado. Usa as mesmas regras do chat (validação de CPF/CNPJ, normalização e envio
          para a Autentique).
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Cliente */}
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="font-medium">Cliente</h2>
          {cliente ? (
            <div className="flex items-center justify-between gap-2 rounded-md bg-muted p-3 text-sm">
              <span>
                Selecionado: <strong>{cliente.name}</strong>
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCliente(null)}>
                Trocar
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  placeholder="Buscar por nome, CPF ou CNPJ"
                  value={clientQuery}
                  onChange={(e) => setClientQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void doSearch();
                    }
                  }}
                />
                <Button type="button" variant="secondary" onClick={() => void doSearch()}>
                  Buscar
                </Button>
              </div>
              {clientResults.length > 0 && (
                <ul className="divide-y rounded-md border">
                  {clientResults.map((c) => (
                    <li key={c.id} className="flex items-center justify-between p-2 text-sm">
                      <span>
                        {c.name} <span className="text-muted-foreground">— {c.cpf ?? c.cnpj}</span>
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setCliente({ id: c.id, name: c.name })}
                      >
                        Selecionar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowNewClient((v) => !v)}
              >
                {showNewClient ? "Cancelar novo cliente" : "+ Novo cliente"}
              </Button>
              {showNewClient && (
                <div className="grid grid-cols-1 gap-3 rounded-md border bg-muted/40 p-3 sm:grid-cols-2">
                  <div className="sm:col-span-2 space-y-1">
                    <Label>Nome</Label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>CPF ou CNPJ</Label>
                    <Input
                      value={newDoc}
                      onChange={(e) => setNewDoc(e.target.value)}
                      placeholder="apenas números"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Telefone</Label>
                    <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="button" onClick={() => void createClient()}>
                      Salvar cliente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* Produtos */}
        <section className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Produtos / serviços</h2>
            <Button type="button" variant="ghost" size="sm" onClick={addProduto}>
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>
          {produtos.map((p, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <Input
                className="col-span-6"
                placeholder="Descrição"
                value={p.descricao}
                onChange={(e) => updateProduto(i, { descricao: e.target.value })}
              />
              <Input
                className="col-span-2"
                type="number"
                min={1}
                max={99}
                value={p.quantidade}
                onChange={(e) => updateProduto(i, { quantidade: Number(e.target.value) || 1 })}
              />
              <Input
                className="col-span-3"
                inputMode="decimal"
                placeholder="0,00"
                value={p.preco_brl}
                onChange={(e) => updateProduto(i, { preco_brl: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="col-span-1"
                onClick={() => removeProduto(i)}
                disabled={produtos.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <p className="text-right text-sm text-muted-foreground">
            Total: <strong className="text-foreground">{valorBrl}</strong>
          </p>
        </section>

        {/* Pagamento */}
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="font-medium">Pagamento</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Forma</Label>
              <Select value={forma} onValueChange={(v) => setForma(v as typeof forma)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avista">À vista</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                  <SelectItem value="misto">Entrada + parcelas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(forma === "parcelado" || forma === "misto") && (
              <div className="space-y-1">
                <Label>Parcelas</Label>
                <Input
                  type="number"
                  min={1}
                  max={36}
                  value={parcelas}
                  onChange={(e) => setParcelas(Number(e.target.value) || 1)}
                />
              </div>
            )}
            {forma === "misto" && (
              <div className="space-y-1">
                <Label>Entrada (R$)</Label>
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={entradaBrl}
                  onChange={(e) => setEntradaBrl(e.target.value)}
                />
              </div>
            )}
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate({ to: "/transacoes" })}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={busy || !cliente || valorCents <= 0}>
            {busy ? "Enviando…" : "Criar e enviar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
