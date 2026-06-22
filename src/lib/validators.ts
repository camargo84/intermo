// Validadores de documentos brasileiros + utilidades

export function onlyDigits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D+/g, "");
}

export function validateCPF(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (base: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += parseInt(base[i], 10) * (factor - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = calc(cpf.slice(0, 9), 10);
  const d2 = calc(cpf.slice(0, 10), 11);
  return d1 === parseInt(cpf[9], 10) && d2 === parseInt(cpf[10], 10);
}

export function validateCNPJ(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += parseInt(base[i], 10) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj.slice(0, 12), w1);
  const d2 = calc(cnpj.slice(0, 13), w2);
  return d1 === parseInt(cnpj[12], 10) && d2 === parseInt(cnpj[13], 10);
}

export interface ViaCepResult {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export async function lookupCEP(rawCep: string): Promise<ViaCepResult | null> {
  const cep = onlyDigits(rawCep);
  if (cep.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as ViaCepResult;
    if (data.erro) return null;
    return data;
  } catch {
    return null;
  }
}

// --- Número por extenso (para valor em reais) ---
const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const dez_a_dezenove = [
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];
const dezenas = [
  "",
  "",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
];
const centenas = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

function ate999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(centenas[c]);
  if (resto > 0) {
    if (resto < 10) partes.push(unidades[resto]);
    else if (resto < 20) partes.push(dez_a_dezenove[resto - 10]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u > 0 ? `${dezenas[d]} e ${unidades[u]}` : dezenas[d]);
    }
  }
  return partes.join(" e ");
}

function juntarGrupos(partes: string[], ultimoValor: number): string {
  // Une grupos seguindo a norma do "e": o conector liga o ÚLTIMO grupo
  // somente quando seu valor numérico é < 100 ou múltiplo exato de 100
  // (cem, duzentos... quinhentos). Ex.: "mil e quinhentos" (500), mas
  // "mil novecentos e noventa e nove" (999, não conecta com "e").
  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0];
  const ultimo = partes[partes.length - 1];
  const anteriores = partes.slice(0, -1).join(", ");
  const levaE = ultimoValor < 100 || ultimoValor % 100 === 0;
  return levaE ? `${anteriores} e ${ultimo}` : `${anteriores} ${ultimo}`;
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero";
  const bilhoes = Math.floor(n / 1_000_000_000);
  const milhoes = Math.floor((n % 1_000_000_000) / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (bilhoes > 0) partes.push(bilhoes === 1 ? "um bilhão" : `${ate999(bilhoes)} bilhões`);
  if (milhoes > 0) partes.push(milhoes === 1 ? "um milhão" : `${ate999(milhoes)} milhões`);
  if (milhares > 0) partes.push(milhares === 1 ? "mil" : `${ate999(milhares)} mil`);
  if (resto > 0) partes.push(ate999(resto));
  // valor do último grupo não-nulo, para decidir o conector "e"
  const ultimoValor = resto > 0 ? resto : milhares > 0 ? milhares : milhoes > 0 ? milhoes : bilhoes;
  return juntarGrupos(partes, ultimoValor);
}

/** Indica se o inteiro termina em milhão/bilhão "redondo" (exige "de reais"). */
function exigeDe(reais: number): boolean {
  if (reais < 1_000_000) return false;
  return reais % 1_000_000 === 0;
}

export function valorPorExtenso(cents: number): string {
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;
  const partes: string[] = [];
  if (reais > 0) {
    const moeda = reais === 1 ? "real" : exigeDe(reais) ? "de reais" : "reais";
    partes.push(`${inteiroPorExtenso(reais)} ${moeda}`);
  }
  if (centavos > 0)
    partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  if (partes.length === 0) return "zero real";
  return partes.join(" e ");
}

/** Formata centavos (inteiro) como moeda BRL. Para reais decimais, use `brl` de `@/lib/format`. */
export function brlFromCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
