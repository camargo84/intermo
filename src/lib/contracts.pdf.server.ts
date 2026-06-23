import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type PDFImage,
} from "@cantoo/pdf-lib";
import { brlFromCents, valorPorExtenso } from "./validators";
import { formatPhoneBR } from "./format";

export interface TenantSnapshot {
  company_legal_name?: string | null;
  company_fantasy_name?: string | null;
  company_cnpj?: string | null;
  company_address?: string | null;
  company_city?: string | null;
  company_uf?: string | null;
  company_cep?: string | null;
  company_email?: string | null;
  company_phone?: string | null;
  representative_name?: string | null;
  representative_qualification?: string | null;
  representative_cpf?: string | null;
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
  phone?: string | null;
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
    return c.length === 14
      ? c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
      : c;
  }
  if (cpf) {
    const c = cpf.replace(/\D/g, "");
    return c.length === 11
      ? c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
      : c;
  }
  return "";
}

function formatCep(cep?: string | null): string {
  if (!cep) return "";
  const c = cep.replace(/\D/g, "");
  return c.length === 8 ? c.replace(/(\d{5})(\d{3})/, "$1-$2") : c;
}

function safePhone(phone?: string | null): string {
  if (!phone) return "";
  try {
    return formatPhoneBR(phone);
  } catch {
    return phone;
  }
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

  const t = args.tenant;
  const c = args.cliente;

  // ===== Título =====
  drawText("CONTRATO DE ENCOMENDA", 14, bold);
  gap(8);
  drawText("DAS PARTES", 11, bold);
  gap(4);

  // ===== CONTRATANTE (cliente) =====
  const cliDoc = formatDoc(c.cpf, c.cnpj);
  const cliEnd = [
    c.endereco,
    c.complemento,
    c.bairro ? `bairro ${c.bairro}` : "",
    c.cep ? `CEP ${formatCep(c.cep)}` : "",
    c.cidade && c.uf ? `${c.cidade} - ${c.uf}` : (c.cidade ?? c.uf ?? ""),
  ]
    .filter(Boolean)
    .join(", ");

  const cliQualif = c.is_pj
    ? `pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${cliDoc}`
    : [
        c.nacionalidade ?? "brasileiro(a)",
        c.estado_civil ?? "",
        `inscrito(a) no CPF sob o nº ${cliDoc}`,
      ]
        .filter(Boolean)
        .join(", ");

  const cliEmail = c.email ? `E-mail: ${c.email}` : "";
  const cliTel = c.phone ? `Celular nº: ${safePhone(c.phone)}` : "";
  const cliContato = [cliEmail, cliTel].filter(Boolean).join(", ");

  const contratanteLine = `CONTRATANTE: ${c.name}, ${cliQualif}${cliEnd ? `, residente e domiciliado(a) à ${cliEnd}` : ""}${cliContato ? `, ${cliContato}` : ""}, doravante denominado(a) CONTRATANTE, e;`;
  drawText(contratanteLine, 11);
  gap();

  // ===== CONTRATADA (empresa) =====
  const tenantDoc = formatDoc(null, t.company_cnpj);
  const tenantEnd = [
    t.company_address,
    t.company_cep ? `CEP: ${formatCep(t.company_cep)}` : "",
    t.company_city && t.company_uf ? `${t.company_city} - ${t.company_uf}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const tenantEmail = t.company_email ? `E-mail: ${t.company_email}` : "";
  const tenantTel = t.company_phone ? `Celular nº: ${safePhone(t.company_phone)}` : "";
  const tenantContato = [tenantEmail, tenantTel].filter(Boolean).join(", ");

  const repCpf = t.representative_cpf ? formatDoc(t.representative_cpf, null) : "";
  const repQualif = [t.representative_qualification, repCpf ? `inscrito no CPF nº ${repCpf}` : ""]
    .filter(Boolean)
    .join(", ");
  const repTrecho = t.representative_name
    ? `, neste ato representada por ${t.representative_name}${repQualif ? `, ${repQualif}` : ""}`
    : "";

  const contratadaLine = `CONTRATADA: ${t.company_legal_name ?? t.company_fantasy_name ?? ""}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${tenantDoc}${tenantEnd ? `, endereço à ${tenantEnd}` : ""}${tenantContato ? `, ${tenantContato}` : ""}${repTrecho}, doravante denominada CONTRATADA.`;
  drawText(contratadaLine, 11);
  gap();

  drawText(
    "Decidem as PARTES, na melhor forma de direito, celebrar o presente CONTRATO DE PRESTAÇÃO DE SERVIÇOS, que reger-se-á mediante as cláusulas e condições adiante estipuladas.",
    11,
  );

  // ===== Cláusulas =====
  heading("CLÁUSULA PRIMEIRA — DO OBJETO");
  drawText(
    "1.1. Constitui o objeto deste instrumento a prestação de serviços pela CONTRATADA ao CONTRATANTE, na modalidade intermediação de serviços.",
    11,
  );

  heading("CLÁUSULA SEGUNDA — EXECUÇÃO DOS SERVIÇOS");
  drawText(
    "2.1. Os serviços objeto deste contrato serão executados pela CONTRATADA, pelo intermédio da compra do(s) produto(s) com as seguintes especificações:",
    11,
  );
  const itens = args.produtos
    .map(
      (p, i) =>
        `${i + 1}. ${p.descricao} — Quantidade: ${p.quantidade} — Preço unitário: ${brlFromCents(p.preco_unit_cents)}`,
    )
    .join("\n");
  drawText(itens, 11);

  heading("CLÁUSULA TERCEIRA — PRAZO, PRORROGAÇÃO E REEMBOLSO");
  drawText(
    "3.1. A CONTRATADA deverá prestar os serviços solicitados dentro do prazo de até 07 (sete) dias úteis, podendo ser concluído em prazo menor levando em conta a logística necessária para cada encomenda.",
    11,
  );
  drawText(
    "3.2. A data de cumprimento do prazo será considerada a data na qual a CONTRATADA encaminhar a solicitação de agendamento da entrega do produto ao CONTRATANTE, ficando plenamente garantida a entrega efetiva conforme o agendamento.",
    11,
  );
  drawText(
    "3.3. No ato da entrega o CONTRATANTE fará a assinatura de recibo referente ao serviço de intermediação de compra do produto.",
    11,
  );
  drawText(
    "3.4. Caso o prazo informado no item 3.1 se expire sem a entrega do produto por motivos que fogem ao controle da CONTRATADA, este prazo poderá ser prorrogado, por uma única vez, por mais 15 (quinze) dias, contados a partir do final do prazo inicial.",
    11,
  );
  drawText(
    "3.5. Sendo o novo prazo de entrega frustrado, o CONTRATANTE poderá, se assim desejar, solicitar formalmente o reembolso total dos valores pagos.",
    11,
  );
  drawText(
    "3.6. Na hipótese de reembolso, a CONTRATADA realizará a devolução dos valores em até 05 (cinco) dias úteis, contados a partir da solicitação de reembolso do CONTRATANTE, por meio de depósito em favor do CONTRATANTE, em conta corrente por este indicada.",
    11,
  );

  heading("CLÁUSULA QUARTA — REMUNERAÇÃO");
  drawText(
    `4.1. O CONTRATANTE deverá pagar à CONTRATADA, a título de remuneração pela prestação dos serviços descritos na CLÁUSULA SEGUNDA, o valor de ${brlFromCents(args.valor_cents)} (${valorPorExtenso(args.valor_cents)}).`,
    11,
  );
  drawText(
    "4.2. O valor descrito no item 4.1 contempla todas as despesas que a CONTRATADA terá com a execução do serviço de intermediação de compra, incluindo frete, taxas e margem de remuneração.",
    11,
  );

  heading("CLÁUSULA QUINTA — FORMA E LOCAL DE PAGAMENTO");
  let pgto = "";
  if (args.forma_pagamento === "avista") {
    pgto = `5.1. O pagamento será realizado à vista (dinheiro / transferência / PIX), referente ao valor total de ${brlFromCents(args.valor_cents)} mencionado no item 4.1.`;
  } else if (args.forma_pagamento === "parcelado") {
    const n = args.parcelas ?? 1;
    pgto = `5.1. O pagamento será realizado mediante parcelamento no cartão em ${n} (${valorPorExtenso(n * 100).replace(/\sreais$/, "")}) vezes, sendo os juros conforme simulação previamente apresentada à parte CONTRATANTE.`;
  } else {
    const saldo = args.valor_cents - args.entrada_cents;
    const n = args.parcelas ?? 1;
    pgto = `5.1. O pagamento será realizado da seguinte forma: entrada de ${brlFromCents(args.entrada_cents)} (${valorPorExtenso(args.entrada_cents)}) no ato, em dinheiro / transferência / PIX, e o saldo remanescente de ${brlFromCents(saldo)} mediante parcelamento no cartão em ${n} (${valorPorExtenso(n * 100).replace(/\sreais$/, "")}) vezes, sendo os juros conforme simulação previamente apresentada à parte CONTRATANTE.`;
  }
  drawText(pgto, 11);

  heading("CLÁUSULA SEXTA — MULTAS");
  drawText(
    "6.1. O presente instrumento representa a manifestação de vontades das PARTES onde há a presunção de boa-fé dos envolvidos, sendo que a partir da assinatura o CONTRATANTE assume as obrigações de adimplemento dos pagamentos junto à CONTRATADA conforme disposto e acordado neste instrumento, estando ciente que não é contemplada a hipótese de mera desistência por parte do CONTRATANTE uma vez que o início da prestação dos serviços já impõe à CONTRATADA a necessidade de firmar compromissos junto a terceiros.",
    11,
  );
  drawText(
    "6.2. Caso o CONTRATANTE insista em se evadir das obrigações assumidas em contrato, conforme hipótese descrita no item 6.1, incidirá multa de natureza não compensatória correspondente a 20% (vinte por cento) sobre o valor do objeto do contrato.",
    11,
  );
  drawText(
    "6.3. O descumprimento, por qualquer das PARTES, das obrigações dispostas neste contrato que não tiverem penalidade específica sujeitará o infrator ao pagamento da multa de natureza não compensatória correspondente a 20% (vinte por cento) sobre o valor do objeto do contrato.",
    11,
  );
  drawText(
    "6.4. A tolerância, por qualquer das PARTES, com relação ao descumprimento de qualquer termo ou condição aqui ajustado, não será considerada como desistência em exigir o cumprimento de disposição nele contida.",
    11,
  );

  heading("CLÁUSULA SÉTIMA — FORTUITO OU FORÇA MAIOR");
  drawText(
    "7.1. As PARTES contratantes não responderão pela omissão ou atraso no cumprimento de qualquer obrigação prevista neste contrato resultante de caso fortuito ou de força maior, que devem ser cabalmente comprovados, na forma do parágrafo único do Art. 393 do Código Civil.",
    11,
  );

  heading("CLÁUSULA OITAVA — DISPOSIÇÕES GERAIS");
  drawText(
    "8.1. Fica a CONTRATADA autorizada a utilizar os dados informados pelo CONTRATANTE perante terceiros com a exclusiva finalidade de realização do serviço de intermediação descrito na CLÁUSULA SEGUNDA.",
    11,
  );
  drawText(
    "8.2. A CONTRATADA atesta que o serviço de INTERMEDIAÇÃO proporciona a entrega de aparelhos que funcionam perfeitamente no Brasil, sendo desbloqueados e compatíveis com quaisquer operadoras que atuem no território nacional.",
    11,
  );
  drawText(
    "8.3. O produto referente ao objeto do presente contrato será entregue na condição “Novo” e terá GARANTIA contra vícios e defeitos de fabricação com cobertura de 12 (doze) meses junto ao fabricante.",
    11,
  );
  drawText(
    "8.4. As PARTES reconhecem expressamente a validade jurídica deste contrato celebrado eletronicamente, nos termos da Medida Provisória nº 2.200-2/2001, sendo a data, o local e a autoria da assinatura registrados pela plataforma de assinatura eletrônica utilizada.",
    11,
  );

  heading("CLÁUSULA NONA — FORO");
  drawText(
    `9.1. As PARTES elegem o foro da Comarca de ${t.comarca ?? ""}, com a renúncia de qualquer outro, por mais privilegiado que seja, para dirimir dúvidas oriundas deste contrato.`,
    11,
  );

  gap(14);
  drawText("E por estarem assim justos e contratados, firmam o presente compromisso.", 11);

  // ===== Bloco de assinatura (sem testemunhas) =====
  gap(18);
  ensureSpace(70);
  drawText(`CONTRATADA: ${t.company_legal_name ?? t.company_fantasy_name ?? ""}`, 11, bold);
  drawText(`CNPJ nº: ${tenantDoc}`, 11);
  gap(10);
  drawText(`CONTRATANTE: ${c.name}`, 11, bold);
  drawText(`${c.is_pj ? "CNPJ" : "CPF"} nº: ${cliDoc}`, 11);

  // ===== Cabeçalho (logo) e rodapé (paginação) =====
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
    const black = rgb(0, 0, 0);
    p.drawLine({
      start: { x: margin, y: pageHeight - margin - headerH + 22 },
      end: { x: pageWidth - margin, y: pageHeight - margin - headerH + 22 },
      thickness: 0.6,
      color: black,
    });
    p.drawLine({
      start: { x: margin, y: margin + footerH - 12 },
      end: { x: pageWidth - margin, y: margin + footerH - 12 },
      thickness: 0.6,
      color: black,
    });
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
