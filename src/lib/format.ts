/**
 * Utilitários de formatação pt-BR.
 */
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const brl = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

export const formatDate = (date: Date | string, pattern = "dd/MM/yyyy") =>
  format(typeof date === "string" ? new Date(date) : date, pattern, { locale: ptBR });

/** Aceita 14+ chars, retorna formato 00.000.000/0000-00. */
export function formatCNPJ(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/** Validação dos dígitos verificadores do CNPJ. */
export function isValidCNPJ(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calc = (slice: string, weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + Number(slice[i]) * w, 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calc(digits.slice(0, 12), w1);
  const d2 = calc(digits.slice(0, 12) + d1, w2);
  return d1 === Number(digits[12]) && d2 === Number(digits[13]);
}

export function formatPhoneBR(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

/**
 * Abrevia o "miolo" de um nome composto: mantém primeiro e último por extenso,
 * vira o restante em iniciais. Partículas (de/da/do/dos/das/e) são preservadas
 * em minúsculas e não contam como partes a abreviar.
 *
 *   "Thales Carlos Gomes Silva"   -> "Thales C. G. Silva"
 *   "Thales Gomes Silva"          -> "Thales G. Silva"
 *   "Maria Silva"                 -> "Maria Silva"
 *   "Ana Paula de Souza Lima"     -> "Ana P. S. Lima"
 */
export function abbreviateName(full: string | null | undefined): string {
  if (!full) return "";
  const cleaned = full.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const particles = new Set(["de", "da", "do", "dos", "das", "e"]);
  const parts = cleaned.split(" ").filter(Boolean);
  const meaningful = parts.filter((p) => !particles.has(p.toLowerCase()));
  if (meaningful.length <= 2) return meaningful.join(" ");
  const first = meaningful[0];
  const last = meaningful[meaningful.length - 1];
  const middle = meaningful.slice(1, -1).map((m) => {
    const ch = Array.from(m)[0] ?? "";
    return `${ch.toUpperCase()}.`;
  });
  return [first, ...middle, last].join(" ");
}

/**
 * Formata data/hora para o label da sidebar de conversas.
 *  - hoje              -> "hoje 14:32"
 *  - ontem             -> "ontem 09:10"
 *  - dentro de 7 dias  -> "qua 16:40"
 *  - este ano          -> "23/abr 14:32"
 *  - outro ano         -> "23/abr/24"
 */
export function formatThreadTimestamp(input: Date | string | number): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.floor((startOfDay(now) - startOfDay(date)) / 86_400_000);
  const hhmm = format(date, "HH:mm");
  if (diffDays === 0) return `hoje ${hhmm}`;
  if (diffDays === 1) return `ontem ${hhmm}`;
  if (diffDays > 1 && diffDays < 7) {
    return `${format(date, "EEE", { locale: ptBR }).toLowerCase().replace(".", "")} ${hhmm}`;
  }
  if (date.getFullYear() === now.getFullYear()) {
    return `${format(date, "dd/MMM", { locale: ptBR }).toLowerCase()} ${hhmm}`;
  }
  return format(date, "dd/MMM/yy", { locale: ptBR }).toLowerCase();
}
