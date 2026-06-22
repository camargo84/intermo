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
        "title,client_name,client_doc,value_cents,entrada_cents,supplier_name,supplier_paid_amount_cents,freight_carrier,freight_paid_amount_cents,client_paid_at,supplier_paid_at,freight_paid_at,signed_at,consolidated,margin_cents,status,created_at",
      )
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const monthName = new Date(Date.UTC(data.year, data.month - 1, 1))
      .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const ws = wb.addWorksheet(monthName.toUpperCase().slice(0, 31));

    const money = '"R$" #,##0.00;[Red]("R$" #,##0.00);-';
    ws.columns = [
      { header: "Data", key: "data", width: 12 },
      { header: "Contrato", key: "title", width: 36 },
      { header: "Cliente", key: "client", width: 28 },
      { header: "CPF/CNPJ", key: "doc", width: 18 },
      { header: "Valor (R$)", key: "valor", width: 14, style: { numFmt: money } },
      { header: "Entrada (R$)", key: "entrada", width: 14, style: { numFmt: money } },
      { header: "Fornecedor", key: "supplier", width: 24 },
      { header: "Pago forn. (R$)", key: "supplierPaid", width: 14, style: { numFmt: money } },
      { header: "Transportadora", key: "freight", width: 20 },
      { header: "Frete (R$)", key: "freightPaid", width: 12, style: { numFmt: money } },
      { header: "Margem (R$)", key: "margem", width: 14, style: { numFmt: money } },
      { header: "Status", key: "status", width: 12 },
      { header: "Consolidada", key: "consolidated", width: 12 },
    ];
    ws.getRow(1).font = { bold: true };

    const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "");

    for (const r of rows ?? []) {
      ws.addRow({
        data: fmtDate(r.created_at as string | null),
        title: r.title,
        client: r.client_name,
        doc: r.client_doc ?? "",
        valor: ((r.value_cents as number | null) ?? 0) / 100,
        entrada: ((r.entrada_cents as number | null) ?? 0) / 100,
        supplier: r.supplier_name ?? "",
        supplierPaid: ((r.supplier_paid_amount_cents as number | null) ?? 0) / 100,
        freight: r.freight_carrier ?? "",
        freightPaid: ((r.freight_paid_amount_cents as number | null) ?? 0) / 100,
        margem: ((r.margin_cents as number | null) ?? 0) / 100,
        status: r.status ?? "",
        consolidated: r.consolidated ? "Sim" : "Não",
      });
    }

    const last = ws.lastRow?.number ?? 1;
    if (last > 1) {
      const totalRow = ws.addRow({
        title: "TOTAL",
        valor: { formula: `SUM(E2:E${last})` },
        entrada: { formula: `SUM(F2:F${last})` },
        supplierPaid: { formula: `SUM(H2:H${last})` },
        freightPaid: { formula: `SUM(J2:J${last})` },
        margem: { formula: `SUM(K2:K${last})` },
      });
      totalRow.font = { bold: true };
    }

    const buf = await wb.xlsx.writeBuffer();
    const u8 = new Uint8Array(buf as ArrayBuffer);
    let bin = "";
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return {
      base64: btoa(bin),
      filename: `financeiro-${data.year}-${String(data.month).padStart(2, "0")}.xlsx`,
    };
  });
