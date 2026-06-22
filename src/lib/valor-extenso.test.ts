import { describe, it, expect } from "vitest";
import { valorPorExtenso } from "./validators";

describe("valorPorExtenso — redação para contrato (validade jurídica)", () => {
  it("valores simples", () => {
    expect(valorPorExtenso(100)).toBe("um real");
    expect(valorPorExtenso(200)).toBe("dois reais");
    expect(valorPorExtenso(1)).toBe("um centavo");
    expect(valorPorExtenso(99)).toBe("noventa e nove centavos");
    expect(valorPorExtenso(0)).toBe("zero real");
  });

  it("reais e centavos combinados", () => {
    expect(valorPorExtenso(199)).toBe("um real e noventa e nove centavos");
    expect(valorPorExtenso(100050)).toBe("mil reais e cinquenta centavos");
  });

  it("conector 'e' entre milhar e o resto", () => {
    // < 100 ou centena redonda no fim → leva "e"
    expect(valorPorExtenso(150000)).toBe("mil e quinhentos reais");
    expect(valorPorExtenso(900000)).toBe("nove mil reais");
    // centena + dezena/unidade → NÃO leva "e" depois do milhar
    expect(valorPorExtenso(199900)).toBe("mil novecentos e noventa e nove reais");
    expect(valorPorExtenso(123400)).toBe("mil duzentos e trinta e quatro reais");
  });

  it("milhão/milhões exigem 'de' quando não há complemento", () => {
    expect(valorPorExtenso(100000000)).toBe("um milhão de reais");
    expect(valorPorExtenso(200000000)).toBe("dois milhões de reais");
  });

  it("milhão com complemento NÃO leva 'de'", () => {
    expect(valorPorExtenso(150000000)).toBe("um milhão e quinhentos mil reais");
    expect(valorPorExtenso(101000000)).toBe("um milhão e dez mil reais");
  });
});
