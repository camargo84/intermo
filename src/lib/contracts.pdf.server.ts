import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

interface RenderArgs {
  title: string;
  content: string;
  clientName: string;
  clientEmail: string;
  clientDoc?: string | null;
  valueCents?: number | null;
}

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export async function renderContractPdf(args: RenderArgs): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 56;
  const maxWidth = pageWidth - margin * 2;
  const ink = rgb(0.07, 0.09, 0.15);
  const muted = rgb(0.35, 0.4, 0.5);

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  const wrap = (text: string, size: number, f = font): string[] => {
    const lines: string[] = [];
    for (const paragraph of text.split(/\n/)) {
      if (paragraph.trim() === "") {
        lines.push("");
        continue;
      }
      const words = paragraph.split(/\s+/);
      let line = "";
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(candidate, size) > maxWidth) {
          if (line) lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) lines.push(line);
    }
    return lines;
  };

  const drawText = (text: string, size: number, f = font, color = ink) => {
    const lines = wrap(text, size, f);
    const lineHeight = size * 1.4;
    for (const line of lines) {
      ensureSpace(lineHeight);
      page.drawText(line, { x: margin, y: y - size, size, font: f, color });
      y -= lineHeight;
    }
  };

  // Header
  drawText(args.title, 20, bold);
  y -= 8;
  drawText(`Emitido em ${new Date().toLocaleDateString("pt-BR")}`, 10, font, muted);
  y -= 16;

  // Parties
  drawText("CONTRATANTE", 10, bold, muted);
  drawText(args.clientName, 12, bold);
  const clientLine = [
    args.clientEmail,
    args.clientDoc ? `Documento: ${args.clientDoc}` : null,
  ]
    .filter(Boolean)
    .join("  •  ");
  drawText(clientLine, 11);
  y -= 12;

  if (args.valueCents != null) {
    drawText("VALOR", 10, bold, muted);
    drawText(brl(args.valueCents), 14, bold);
    y -= 12;
  }

  // Body
  drawText("OBJETO", 10, bold, muted);
  y -= 4;
  drawText(args.content, 11);
  y -= 32;

  // Signature line
  ensureSpace(60);
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + 260, y },
    thickness: 0.8,
    color: muted,
  });
  y -= 14;
  drawText(args.clientName, 10, font, muted);

  return await pdf.save();
}
