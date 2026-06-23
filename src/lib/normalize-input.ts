// Normalizadores de input para tools do agente e server functions.
// Aceitam o que o usuário escreve em linguagem natural (formatos BR) e
// devolvem o formato canônico esperado pelo banco/validações.
//
// Em erro, lançam `InputFormatError` com `field` e `message` em pt-BR
// para que o caller devolva `{ ok: false, error_code: "INVALID_INPUT", ... }`.

import { onlyDigits } from "./validators";

export class InputFormatError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = "InputFormatError";
    this.field = field;
  }
}

/**
 * Aceita: "DD/MM/YYYY", "DD-MM-YYYY", "YYYY-MM-DD", "DD/MM/YY", Date ISO.
 * Devolve "YYYY-MM-DD" (ou null se input vazio).
 */
export function normalizeDateBR(
  raw: string | null | undefined,
  field = "data_nascimento",
): string | null {
  if (raw == null) return null;
  const v = String(raw).trim();
  if (!v) return null;

  let y: number, m: number, d: number;

  // ISO YYYY-MM-DD (ou YYYY/MM/DD)
  const iso = v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else {
    // BR DD/MM/YYYY ou DD-MM-YYYY ou DD/MM/YY
    const br = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
    if (!br) {
      throw new InputFormatError(
        field,
        `Data inválida: "${v}". Use o formato DD/MM/AAAA (ex.: 25/11/1996).`,
      );
    }
    d = Number(br[1]);
    m = Number(br[2]);
    y = Number(br[3]);
    if (y < 100) {
      // janela: 00-30 → 2000+, 31-99 → 1900+
      y = y <= 30 ? 2000 + y : 1900 + y;
    }
  }

  const currentYear = new Date().getUTCFullYear();
  if (!Number.isFinite(y) || y < 1900 || y > currentYear) {
    throw new InputFormatError(field, `Ano inválido: ${y}.`);
  }
  if (m < 1 || m > 12) {
    throw new InputFormatError(field, `Mês inválido: ${m}.`);
  }
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d < 1 || d > daysInMonth) {
    throw new InputFormatError(field, `Dia inválido: ${d}/${m}/${y}.`);
  }

  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

export function normalizeCEP(raw: string | null | undefined, field = "cep"): string | null {
  if (raw == null) return null;
  const v = String(raw).trim();
  if (!v) return null;
  const digits = onlyDigits(v);
  if (digits.length !== 8) {
    throw new InputFormatError(field, `CEP inválido: "${v}". Deve ter 8 dígitos.`);
  }
  return digits;
}

export function normalizePhoneBR(raw: string | null | undefined, field = "phone"): string | null {
  if (raw == null) return null;
  const v = String(raw).trim();
  if (!v) return null;
  const digits = onlyDigits(v);
  if (digits.length < 10 || digits.length > 11) {
    throw new InputFormatError(
      field,
      `Telefone inválido: "${v}". Use DDD + número (10 ou 11 dígitos).`,
    );
  }
  return digits;
}
