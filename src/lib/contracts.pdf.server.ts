import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type PDFImage,
} from "pdf-lib";
import { brl, valorPorExtenso } from "./validators";

export interface TenantSnapshot {
  company_legal_name?: string | null;
  company_fantasy_name?: string | null;
  company_cnpj?: string | null;
  company_address?: string | null;
  company_city?: string | null;
  company_uf?: string | null;
  company_cep?: string | null;
  representative_name?: string | null;
  representative_qualification?: string | null;
  comarca?: string | null;
}

export interface ContractClient {
  name: string;
  cpf?: string | null;
  cnpj?: string | null;
  rg?: string | null;
  nacionalidade?: string | null;
  estado_civil?: string | null;
  endereco?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  email?: string | null;
  is_pj?: boolean;
}

export interface ContractProduto {
  descricao: string;
  quantidade: number;
  preco_unit_cents: number;
}

export interface RenderContractArgs {
  tenant: TenantSnapshot;
  cliente: ContractClient;
  produtos: ContractProduto[];
  valor_cents: number;
  forma_pagamento: "avista" | "parcelado" | "misto";
  entrada_cents: number;
  parcelas?: number | null;
  logoBytes?: Uint8Array | null;
  logoMime?: "image/png" | "image/jpeg" | null;
  emitidoEm?: Date;
}

function formatDoc(cpf?: string | null, cnpj?: string | null): string {
  if (cnpj) {
    const c = cnpj.replace(/\D/g, "");
    return c.length === 14 ? c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : c;
  }
  if (cpf) {
    const c = cpf.replace(/\D/g, "");
    return c.length === 11 ? c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : c;
  }
  return "";
}

function formatCep(cep?: string | null): string {
  if (!cep) return "";
  const c = cep.replace(/\D/g, "");
  return c.length === 8 ? c.replace(/(\d{5})(\d{3})/, "$1-$2") : c;
}

export async function renderContractPdf(args: RenderContractArgs): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 56;
  const headerH = 70;
  const footerH = 40;
  const contentTop = pageHeight - margin - headerH;
  const contentBottom = margin + footerH;
  const maxWidth = pageWidth - margin * 2;
  const ink = rgb(0.07, 0.09, 0.15);
  const muted = rgb(0.4, 0.45, 0.55);

  let logoImage: PDFImage | null = null;
  if (args.logoBytes && args.logoBytes.length > 0) {
    try {
      logoImage =
        args.logoMime === "image/jpeg"
          ? await pdf.embedJpg(args.logoBytes)
          : await pdf.embedPng(args.logoBytes);
    } catch {
      logoImage = null;
    }
  }

  const pages: PDFPage[] = [];
  let page = pdf.addPage([pageWidth, pageHeight]);
  pages.push(page);
  let y = contentTop;

  const newPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    pages.push(page);
    y = contentTop;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < contentBottom) newPage();
  };

  const wrap = (text: string, size: number, f: PDFFont): string[] => {
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
        } else line = candidate;
      }
      if (line) lines.push(line);
    }
    return lines;
  };

  const drawText = (text: string, size = 11, f: PDFFont = font, color = ink) => {
    const lines = wrap(text, size, f);
    const lineHeight = size * 1.45;
    for (const line of lines) {
      ensureSpace(lineHeight);
      page.drawText(line, { x: margin, y: y - size, size, font: f, color });
      y -= lineHeight;
    }
  };

  const heading = (text: string) => {
    y -= 6;
    ensureSpace(18);
    drawText(text, 11, bold);
    y -= 2;
  };

  const gap = (n = 8) => {
    y -= n;
  };

  // Título
  drawText("CONTRATO DE COMPRA E VENDA DE BENS MÓVEIS", 14, bold);
  gap(10);

  // Partes
  const t = args.tenant;
  const c = args.cliente;
  const tenantEnd = [t.company_address, t.company_city, t.company_uf].filter(Boolean).join(", ");
  const tenantDoc = formatDoc(null, t.company_cnpj);
  const tenantLine = `VENDEDORA: ${t.company_legal_name ?? t.company_fantasy_name ?? ""}, pessoa jurídica de direito privado, inscrita no CNPJ sob nº ${tenantDoc}, com sede em ${tenantEnd}${t.company_cep ? `, CEP ${formatCep(t.company_cep)}` : ""}, neste ato representada por ${t.representative_name ?? ""}${t.representative_qualification ? `, ${t.representative_qualification}` : ""}, doravante denominada simplesmente VENDEDORA.`;
  drawText(tenantLine, 11);
  gap();

  const clienteDoc = formatDoc(c.cpf, c.cnpj);
  const clienteEnd = [
    c.endereco,
    c.complemento,
    c.bairro,
    c.cidade && c.uf ? `${c.cidade}/${c.uf}` : (c.cidade ?? c.uf),
    c.cep ? `CEP ${formatCep(c.cep)}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const qualif = c.is_pj
    ? `pessoa jurídica de direito privado, inscrita no CNPJ sob nº ${clienteDoc}`
    : `${c.nacionalidade ?? "brasileiro(a)"}, ${c.estado_civil ?? "—"}, portador(a) do RG nº ${c.rg ?? "—"} e inscrito(a) no CPF sob nº ${clienteDoc}`;
  const clienteLine = `COMPRADOR(A): ${c.name}, ${qualif}, residente e domiciliado(a) em ${clienteEnd}, doravante denominado(a) simplesmente COMPRADOR(A).`;
  drawText(clienteLine, 11);
  gap();

  drawText(
    "As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Compra e Venda de Bens Móveis, que se regerá pelas cláusulas seguintes e pelas condições descritas no presente.",
    11,
  );

  // Cláusulas
  heading("CLÁUSULA 1ª — DO OBJETO");
  const itens = args.produtos
    .map(
      (p, i) =>
        `${i + 1}. ${p.descricao} — Quantidade: ${p.quantidade} — Preço unitário: ${brl(p.preco_unit_cents)}`,
    )
    .join("\n");
  drawText(
    `O presente contrato tem como objeto a venda, pela VENDEDORA ao(à) COMPRADOR(A), dos seguintes bens móveis:\n${itens}`,
    11,
  );

  heading("CLÁUSULA 2ª — DO PREÇO");
  drawText(
    `O valor total do presente contrato é de ${brl(args.valor_cents)} (${valorPorExtenso(args.valor_cents)}).`,
    11,
  );

  heading("CLÁUSULA 3ª — DA FORMA DE PAGAMENTO");
  let pgto = "";
  if (args.forma_pagamento === "avista") {
    pgto = `O pagamento será realizado à vista, no ato da celebração deste contrato, no valor integral de ${brl(args.valor_cents)}.`;
  } else if (args.forma_pagamento === "parcelado") {
    const n = args.parcelas ?? 1;
    const parcela = Math.round(args.valor_cents / n);
    pgto = `O pagamento será realizado de forma parcelada em ${n} parcela(s) de aproximadamente ${brl(parcela)}, conforme combinado entre as partes.`;
  } else {
    const saldo = args.valor_cents - args.entrada_cents;
    const n = args.parcelas ?? 1;
    const parcela = Math.round(saldo / n);
    pgto = `O pagamento será realizado da seguinte forma: entrada de ${brl(args.entrada_cents)} (${valorPorExtenso(args.entrada_cents)}) no ato, e o saldo remanescente de ${brl(saldo)} em ${n} parcela(s) de aproximadamente ${brl(parcela)}.`;
  }
  drawText(pgto, 11);

  heading("CLÁUSULA 4ª — DA ENTREGA");
  drawText(
    "A entrega do(s) bem(ns) ocorrerá após a confirmação do pagamento (ou da entrada, nas modalidades parcelada e mista), em prazo e local previamente acordado entre as partes, sendo de responsabilidade do(a) COMPRADOR(A) a conferência do(s) item(ns) no momento do recebimento.",
    11,
  );

  heading("CLÁUSULA 5ª — DA GARANTIA");
  drawText(
    "Os bens objeto deste contrato possuem a garantia legal prevista no Código de Defesa do Consumidor (Lei nº 8.078/1990), bem como eventual garantia contratual oferecida pelo fabricante, nos termos da respectiva documentação que acompanha o produto. A VENDEDORA não se responsabiliza por danos decorrentes de uso indevido, acidente ou alteração não autorizada do bem.",
    11,
  );

  heading("CLÁUSULA 6ª — DA TRANSFERÊNCIA DE PROPRIEDADE E RISCO");
  drawText(
    "A propriedade do(s) bem(ns) somente se transfere ao(à) COMPRADOR(A) após o pagamento integral do preço ajustado. A partir da entrega, contudo, os riscos pela perda ou deterioração do(s) bem(ns) passam ao(à) COMPRADOR(A).",
    11,
  );

  heading("CLÁUSULA 7ª — DA RESCISÃO");
  drawText(
    "O presente contrato poderá ser rescindido em caso de descumprimento de qualquer de suas cláusulas, mediante notificação prévia à parte inadimplente, sem prejuízo das perdas e danos cabíveis. Em caso de inadimplência do(a) COMPRADOR(A) após o recebimento do(s) bem(ns), a VENDEDORA poderá cobrar o saldo devedor pelos meios legais cabíveis.",
    11,
  );

  heading("CLÁUSULA 8ª — DA VALIDADE JURÍDICA E DA ASSINATURA ELETRÔNICA");
  drawText(
    "As partes reconhecem expressamente a validade jurídica deste contrato celebrado eletronicamente, nos termos da Medida Provisória nº 2.200-2/2001, que institui a Infraestrutura de Chaves Públicas Brasileira – ICP-Brasil, e admite outras formas de comprovação de autoria e integridade dos documentos em forma eletrônica desde que aceitas pelas partes.",
    11,
  );

  heading("CLÁUSULA 9ª — DO FORO");
  drawText(
    `Fica eleito o foro da Comarca de ${t.comarca ?? "—"} para dirimir quaisquer questões oriundas do presente contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.`,
    11,
  );

  gap(18);
  drawText(
    `E, por estarem assim justas e contratadas, as partes assinam o presente eletronicamente.`,
    11,
  );
  gap(4);
  const emitido = (args.emitidoEm ?? new Date()).toLocaleDateString("pt-BR");
  drawText(`Local e data: ${t.company_city ?? "—"}/${t.company_uf ?? "—"}, ${emitido}.`, 11);

  // Cabeçalho (logo no topo direito) + rodapé (página X de Y) em todas as páginas
  const total = pages.length;
  pages.forEach((p, idx) => {
    if (logoImage) {
      const maxH = 42;
      const maxW = 140;
      const ratio = logoImage.width / logoImage.height;
      let h = maxH;
      let w = h * ratio;
      if (w > maxW) {
        w = maxW;
        h = w / ratio;
      }
      p.drawImage(logoImage, {
        x: pageWidth - margin - w,
        y: pageHeight - margin - h + 8,
        width: w,
        height: h,
      });
    }
    // separador do header
    p.drawLine({
      start: { x: margin, y: pageHeight - margin - headerH + 22 },
      end: { x: pageWidth - margin, y: pageHeight - margin - headerH + 22 },
      thickness: 0.4,
      color: muted,
    });
    // rodapé
    const label = `Página ${idx + 1} de ${total}`;
    const size = 9;
    const w = font.widthOfTextAtSize(label, size);
    p.drawText(label, {
      x: pageWidth - margin - w,
      y: margin - 4,
      size,
      font,
      color: muted,
    });
  });

  return await pdf.save();
}
