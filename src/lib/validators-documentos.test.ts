import { describe, it, expect } from "vitest";
import { validateCPF, validateCNPJ, onlyDigits, brlFromCents } from "./validators";
import { isValidCNPJ, brl, formatCNPJ, formatPhoneBR } from "./format";

describe("validateCPF", () => {
  it("aceita CPFs válidos (com e sem máscara)", () => {
    expect(validateCPF("11144477735")).toBe(true);
    expect(validateCPF("529.982.247-25")).toBe(true);
  });
  it("rejeita dígitos repetidos, verificadores errados e tamanho inválido", () => {
    expect(validateCPF("11111111111")).toBe(false);
    expect(validateCPF("123.456.789-00")).toBe(false);
    expect(validateCPF("123")).toBe(false);
    expect(validateCPF("")).toBe(false);
  });
});

describe("validateCNPJ / isValidCNPJ — devem concordar (sem drift)", () => {
  const casos: Array<[string, boolean]> = [
    ["11222333000181", true],
    ["11.444.777/0001-61", true],
    ["11111111111111", false],
    ["11222333000180", false], // verificador errado
    ["", false],
    ["123", false],
  ];
  it.each(casos)("CNPJ %s → %s nas duas implementações", (cnpj, esperado) => {
    expect(validateCNPJ(cnpj)).toBe(esperado);
    expect(isValidCNPJ(cnpj)).toBe(esperado);
  });
});

describe("onlyDigits", () => {
  it("extrai apenas dígitos e tolera null/undefined", () => {
    expect(onlyDigits("11.222.333/0001-81")).toBe("11222333000181");
    expect(onlyDigits(null)).toBe("");
    expect(onlyDigits(undefined)).toBe("");
  });
});

describe("brl — duas funções, unidades OPOSTAS (trava de regressão de 100x)", () => {
  it("brl de format.ts recebe REAIS (decimal)", () => {
    expect(brl(149)).toBe("R$\u00a0149,00");
    expect(brl(1234.56)).toBe("R$\u00a01.234,56");
  });
  it("brlFromCents de validators.ts recebe CENTAVOS (inteiro)", () => {
    expect(brlFromCents(14900)).toBe("R$\u00a0149,00");
    expect(brlFromCents(123456)).toBe("R$\u00a01.234,56");
  });
  it("a mesma quantia produz string igual a partir de unidades diferentes", () => {
    expect(brlFromCents(14900)).toBe(brl(149));
  });
});

describe("formatCNPJ / formatPhoneBR", () => {
  it("formatCNPJ aplica máscara progressiva", () => {
    expect(formatCNPJ("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCNPJ("abc")).toBe("");
  });
  it("formatPhoneBR distingue fixo (10) e celular (11)", () => {
    expect(formatPhoneBR("11987654321")).toBe("(11) 98765-4321");
    expect(formatPhoneBR("1133334444")).toBe("(11) 3333-4444");
    expect(formatPhoneBR("119876543210000")).toBe("(11) 98765-4321"); // trunca excedente
  });
});
