import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Loader2, AlertCircle, Eraser } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Página PÚBLICA de assinatura white-label (sem autenticação).
// Fica FORA de _authenticated. Carrega os dados do contrato via GET ao
// endpoint público e captura a assinatura eletrônica (canvas ou nome digitado).

export const Route = createFileRoute("/assinar/$token")({
  head: () => ({ meta: [{ title: "Assinar contrato — inTermo" }] }),
  component: SignPage,
});

type ContractData = {
  lojista: string;
  cliente: string;
  signerName: string;
  produto: string;
  valorCents: number | null;
  pdfUrl: string | null;
};

function formatBRL(cents: number | null): string | null {
  if (cents == null) return null;
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function SignPage() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ContractData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [alreadySigned, setAlreadySigned] = useState(false);

  const [typedName, setTypedName] = useState("");
  const [consent, setConsent] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/sign/${token}`);
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(body?.error ?? "Não foi possível carregar o contrato.");
        } else if (body?.alreadySigned) {
          setAlreadySigned(true);
        } else {
          setData(body as ContractData);
          setTypedName(body?.signerName ?? "");
        }
      } catch {
        if (!cancelled) setLoadError("Falha de conexão. Tente novamente.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }, []);

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    setHasDrawing(true);
  };

  const endDraw = () => {
    drawing.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
  };

  // Gera uma imagem PNG da assinatura: usa o desenho, ou renderiza o nome
  // digitado em estilo manuscrito sobre canvas branco.
  const buildSignaturePng = (): string | null => {
    if (hasDrawing && canvasRef.current) {
      // Compõe sobre fundo branco para garantir legibilidade no PDF.
      const src = canvasRef.current;
      const out = document.createElement("canvas");
      out.width = src.width;
      out.height = src.height;
      const ctx = out.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(src, 0, 0);
      return out.toDataURL("image/png");
    }
    const name = typedName.trim();
    if (name.length >= 2) {
      const out = document.createElement("canvas");
      out.width = 600;
      out.height = 200;
      const ctx = out.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.fillStyle = "#111827";
      ctx.font = "48px 'Brush Script MT', cursive, serif";
      ctx.textBaseline = "middle";
      ctx.fillText(name, 24, 100);
      return out.toDataURL("image/png");
    }
    return null;
  };

  const canSubmit =
    consent && (hasDrawing || typedName.trim().length >= 2) && !submitting;

  const submit = async () => {
    setSubmitError(null);
    const png = buildSignaturePng();
    if (!png) {
      setSubmitError("Desenhe ou digite sua assinatura.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signer_name: typedName.trim(),
          signature_image: png,
          consent: true,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setSubmitError(body?.error ?? "Não foi possível registrar a assinatura.");
      } else {
        setDone(true);
      }
    } catch {
      setSubmitError("Falha de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex h-16 items-center border-b border-border px-6">
        <Logo />
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span>Carregando contrato…</span>
          </div>
        )}

        {!loading && loadError && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" aria-hidden />
              <p className="text-sm text-muted-foreground">{loadError}</p>
            </CardContent>
          </Card>
        )}

        {!loading && (alreadySigned || done) && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-success" aria-hidden />
              <h1 className="font-serif text-2xl">Contrato assinado com sucesso</h1>
              <p className="text-sm text-muted-foreground">
                {done
                  ? "Sua assinatura foi registrada. Uma via ficará disponível para as partes."
                  : "Este contrato já havia sido assinado."}
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && data && !done && !alreadySigned && (
          <div className="space-y-6">
            <div className="space-y-1 text-center">
              <h1 className="font-serif text-2xl text-primary">
                Assinatura de contrato
              </h1>
              <p className="text-sm text-muted-foreground">
                {data.lojista} convidou você para assinar este contrato.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{data.produto}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <Row label="Lojista" value={data.lojista} />
                <Row label="Cliente" value={data.cliente} />
                {formatBRL(data.valorCents) && (
                  <Row label="Valor" value={formatBRL(data.valorCents)!} />
                )}
              </CardContent>
            </Card>

            {data.pdfUrl && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Documento</CardTitle>
                </CardHeader>
                <CardContent>
                  <iframe
                    src={data.pdfUrl}
                    title="Pré-visualização do contrato"
                    className="h-96 w-full rounded-md border border-border bg-white"
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sua assinatura</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sig-canvas">Desenhe sua assinatura</Label>
                  <div className="relative">
                    <canvas
                      id="sig-canvas"
                      ref={canvasRef}
                      width={600}
                      height={200}
                      role="img"
                      aria-label="Área para desenhar a assinatura"
                      className="h-48 w-full touch-none rounded-md border border-border bg-white"
                      onPointerDown={startDraw}
                      onPointerMove={moveDraw}
                      onPointerUp={endDraw}
                      onPointerLeave={endDraw}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearCanvas}
                      className="absolute right-2 top-2"
                    >
                      <Eraser className="mr-1 h-3.5 w-3.5" aria-hidden />
                      Limpar
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="typed-name">Ou digite seu nome completo</Label>
                  <Input
                    id="typed-name"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder="Nome completo"
                    autoComplete="name"
                  />
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="consent"
                    checked={consent}
                    onCheckedChange={(v) => setConsent(v === true)}
                    aria-describedby="consent-desc"
                  />
                  <Label
                    htmlFor="consent"
                    id="consent-desc"
                    className="text-sm font-normal leading-snug text-muted-foreground"
                  >
                    Concordo em assinar eletronicamente este contrato e declaro que
                    a assinatura acima é minha (MP 2.200-2/2001).
                  </Label>
                </div>

                {submitError && (
                  <p className="flex items-center gap-1.5 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" aria-hidden />
                    {submitError}
                  </p>
                )}

                <Button
                  type="button"
                  className="w-full"
                  disabled={!canSubmit}
                  onClick={submit}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Registrando…
                    </>
                  ) : (
                    "Assinar agora"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
