import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2, Maximize2, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

interface LogoCropDialogProps {
  open: boolean;
  file: File | null;
  onClose: () => void;
  /** Recebe um PNG (Blob) já recortado, pronto pra upload. */
  onConfirm: (cropped: Blob) => Promise<void> | void;
}

const MAX_DIM = 800;

export function LogoCropDialog({ open, file, onClose, onConfirm }: LogoCropDialogProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [areaPx, setAreaPx] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const imgElRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!file) {
      setImageSrc(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAspect(undefined);
    setAreaPx(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = useCallback((_a: Area, areaPxNew: Area) => {
    setAreaPx(areaPxNew);
  }, []);

  async function handleAutoCrop() {
    if (!imageSrc) return;
    setBusy(true);
    try {
      const bbox = await detectContentBBox(imageSrc);
      if (!bbox) {
        toast.message("Não consegui detectar bordas. Ajuste manualmente.");
        return;
      }
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setAspect(bbox.width / bbox.height);
      setAreaPx(bbox);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!imageSrc || !areaPx) return;
    setBusy(true);
    try {
      const blob = await cropToPng(imageSrc, areaPx, MAX_DIM);
      await onConfirm(blob);
      onClose();
    } catch (err) {
      toast.error("Falha ao recortar imagem", {
        description: err instanceof Error ? err.message : "Tente outro arquivo.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Recortar logo</DialogTitle>
          <DialogDescription>
            Arraste e use o zoom para enquadrar. A logo aparece no cabeçalho do contrato.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-72 w-full overflow-hidden rounded-md bg-muted">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              objectFit="contain"
              restrictPosition={false}
              showGrid={false}
            />
          ) : null}
          {/* hidden ref pra reaproveitar tamanhos quando precisar */}
          <img ref={imgElRef} src={imageSrc ?? ""} alt="" className="hidden" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <Slider
              min={1}
              max={4}
              step={0.05}
              value={[zoom]}
              onValueChange={(v) => setZoom(v[0] ?? 1)}
              className="flex-1"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoCrop}
              disabled={busy}
            >
              <Wand2 className="mr-2 h-4 w-4" />
              Recortar automaticamente
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAspect(4)}
              disabled={busy}
            >
              <Maximize2 className="mr-2 h-4 w-4" />
              Cabeçalho (4:1)
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAspect(undefined)}
              disabled={busy}
            >
              Livre
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={busy || !areaPx}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirmar e enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ utilitários ------------------------------ */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Detecta a bounding box do conteúdo visível, tratando como "fundo" pixels
 * transparentes ou quase-brancos (> 245 RGB). Cobre o caso comum de logo
 * com fundo branco ou transparente.
 */
async function detectContentBBox(src: string): Promise<Area | null> {
  const img = await loadImage(src);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      const isBg = a < 12 || (r > 245 && g > 245 && b > 245);
      if (!isBg) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0 || maxY < 0) return null;
  // pequena margem
  const pad = Math.round(Math.min(w, h) * 0.02);
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  const width = Math.min(w - x, maxX - minX + 1 + pad * 2);
  const height = Math.min(h - y, maxY - minY + 1 + pad * 2);
  return { x, y, width, height };
}

async function cropToPng(src: string, area: Area, maxDim: number): Promise<Blob> {
  const img = await loadImage(src);
  const scale = Math.min(1, maxDim / Math.max(area.width, area.height));
  const outW = Math.max(1, Math.round(area.width * scale));
  const outH = Math.max(1, Math.round(area.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, outW, outH);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar PNG"))),
      "image/png",
    ),
  );
}
