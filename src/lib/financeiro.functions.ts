import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listFinanceiroMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const start = new Date(Date.UTC(data.year, data.month - 1, 1)).toISOString();
    const end = new Date(Date.UTC(data.year, data.month, 1)).toISOString();
    const { data: rows, error } = await context.supabase
      .from("transactions")
      .select(
        "id,title,client_name,client_doc,client_email,value_cents,entrada_cents,supplier_name,supplier_paid_amount_cents,freight_carrier,freight_paid_amount_cents,client_paid_at,supplier_paid_at,freight_paid_at,signed_at,consolidated,consolidated_at,margin_cents,tax_estimated_cents,status,created_at",
      )
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const exportFinanceiroXlsx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const start = new Date(Date.UTC(data.year, data.month - 1, 1)).toISOString();
    const end = new Date(Date.UTC(data.year, data.month, 1)).toISOString();
    const { data: rows, error } = await context.supabase
      .from("transactions")
      .select(
        "title,content,client_name,client_doc,value_cents,supplier_paid_amount_cents,freight_paid_amount_cents,margin_cents,consolidated,consolidated_at,signed_at,created_at,client:clients(endereco,complemento,bairro,cidade,uf,cep)",
      )
      .eq("consolidated", true)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();

    const mm = String(data.month).padStart(2, "0");
    const lastDay = new Date(Date.UTC(data.year, data.month, 0)).getUTCDate();
    const sheetName = `DE 01-${mm}-${data.year} A ${lastDay}-${mm}-${data.year}`;
    const ws = wb.addWorksheet(sheetName.slice(0, 31));

    const money = '"R$" #,##0.00';
    const ARIAL = { name: "Arial", size: 10 } as const;

    ws.columns = [
      { header: "CPF", key: "cpf", width: 18 },
      { header: "NOME DO CLIENTE", key: "nome", width: 28 },
      { header: "ENDEREÇO", key: "endereco", width: 40 },
      { header: "PRODUTO", key: "produto", width: 30 },
      { header: "VALOR DA REMUNERAÇÃO", key: "remuneracao", width: 20, style: { numFmt: money } },
      { header: "CUSTO", key: "custo", width: 16, style: { numFmt: money } },
      { header: "CUSTO FRETE", key: "frete", width: 16, style: { numFmt: money } },
      { header: "Margem estimada (30%)", key: "margemEstimada", width: 22, style: { numFmt: money } },
      { header: "Margem realizada", key: "margemRealizada", width: 22, style: { numFmt: money } },
      { header: "DESCRIÇÃO DO SERVIÇO", key: "descricao", width: 50 },
      { header: "DATA PARA EMISSÃO", key: "dataEmissao", width: 18 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { ...ARIAL, bold: true };
    headerRow.alignment = { vertical: "middle", wrapText: true };

    const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "");
    const montarEndereco = (
      c: {
        endereco?: string | null;
        complemento?: string | null;
        bairro?: string | null;
        cidade?: string | null;
        uf?: string | null;
        cep?: string | null;
      } | null,
    ) => {
      if (!c) return "";
      const linha1 = [c.endereco, c.complemento].filter(Boolean).join(", ");
      const linha2 = [c.bairro, [c.cidade, c.uf].filter(Boolean).join("/")]
        .filter(Boolean)
        .join(" - ");
      return [linha1, linha2, c.cep].filter(Boolean).join(" — ");
    };

    for (const r of rows ?? []) {
      const client = (r as { client?: Parameters<typeof montarEndereco>[0] }).client ?? null;
      const produto = (r.title ?? "").replace(/^Contrato\s*—\s*/i, "").trim() || (r.content ?? "");
      const valueCents = (r.value_cents as number | null) ?? 0;
      const supplierCents = r.supplier_paid_amount_cents as number | null;
      const freightCents = r.freight_paid_amount_cents as number | null;
      // Margem realizada SÓ existe quando AMBOS os custos foram informados.
      // NULL em qualquer um => célula vazia (não cair para "receita cheia").
      const margemRealizada =
        supplierCents != null && freightCents != null
          ? (valueCents - supplierCents - freightCents) / 100
          : null;
      const row = ws.addRow({
        cpf: r.client_doc ?? "",
        nome: r.client_name,
        endereco: montarEndereco(client),
        produto,
        remuneracao: valueCents / 100,
        custo: supplierCents != null ? supplierCents / 100 : null,
        frete: freightCents != null ? freightCents / 100 : null,
        margemEstimada: (valueCents * 0.3) / 100,
        margemRealizada,
        descricao: `Serviço de intermediação na aquisição de ${produto || "produto"} para ${r.client_name}.`,
        dataEmissao: fmtDate(
          (r.consolidated_at as string | null) ?? (r.signed_at as string | null),
        ),
      });
      row.font = ARIAL;
      row.alignment = { vertical: "top", wrapText: true };
    }

    const last = ws.lastRow?.number ?? 1;
    if (last > 1) {
      ws.addRow({});
      // Coluna H = margem estimada, Coluna I = margem realizada (SUM ignora células vazias).
      const totalEstimadaRow = ws.addRow({
        descricao: "TOTAL MARGEM ESTIMADA (30%)",
        margemEstimada: { formula: `SUM(H2:H${last})` },
      });
      totalEstimadaRow.font = { ...ARIAL, bold: true };
      const totalEstimadaRowNum = totalEstimadaRow.number;
      const totalRealizadaRow = ws.addRow({
        descricao: "TOTAL MARGEM REALIZADA",
        margemRealizada: { formula: `SUM(I2:I${last})` },
      });
      totalRealizadaRow.font = { ...ARIAL, bold: true };
      const impostoRow = ws.addRow({
        descricao: "IMPOSTO ESTIMADO – DAS Simples Nacional (6%) sobre margem estimada",
        margemEstimada: { formula: `H${totalEstimadaRowNum}*0.06` },
      });
      impostoRow.font = { ...ARIAL, bold: true };
    }

    const buf = await wb.xlsx.writeBuffer();
    const u8 = new Uint8Array(buf as ArrayBuffer);
    let bin = "";
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    const monthLabel = new Date(Date.UTC(data.year, data.month - 1, 1))
      .toLocaleDateString("pt-BR", { month: "long" })
      .toUpperCase();
    return {
      base64: btoa(bin),
      filename: `NFS-${monthLabel}-${data.year}.xlsx`,
    };
  });
