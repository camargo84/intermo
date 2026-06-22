import { describe, it, expect } from "vitest";
import { sanitizeMarkdown } from "./markdown";

/**
 * Simula a remoção de ênfase que o react-markdown aplica ao renderizar.
 * Pares de `*`/`_` viram formatação e os marcadores somem. Marcadores
 * escapados com `\` são preservados como literais.
 */
function renderMarkdown(text: string): string {
  // Escapes viram sentinelas SEM `*`/`_`, para que o renderer real não os
  // trate como delimitadores de ênfase (é assim que o react-markdown se comporta).
  const S1 = "\uE001";
  const S2 = "\uE002";
  const escaped = text.split("\\*").join(S1).split("\\_").join(S2);
  const emphasised = escaped
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    .replace(/___(.+?)___/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1");
  return emphasised.split(S1).join("*").split(S2).join("_");
}

describe("sanitizeMarkdown — protege documentos mascarados", () => {
  it("preserva máscara de CPF com asteriscos colados em ponto", () => {
    const input = "CPF ***.***.123-45 confirmado";
    expect(renderMarkdown(sanitizeMarkdown(input))).toBe(input);
  });

  it("preserva duas máscaras na mesma frase", () => {
    const input = "Confira: ***.***.789-09 e RG 12.345-6";
    expect(renderMarkdown(sanitizeMarkdown(input))).toBe(input);
  });

  it("preserva CPF cru pontuado", () => {
    const input = "CPF 123.456.789-09";
    expect(renderMarkdown(sanitizeMarkdown(input))).toBe(input);
  });

  it("preserva telefone e valores monetários", () => {
    const input = "Tel (22) 99999-8888, total R$ 9.000,00";
    expect(renderMarkdown(sanitizeMarkdown(input))).toBe(input);
  });

  it("mantém ênfase markdown legítima sobre palavras", () => {
    const input = "**Cliente:** Maria, dado *importante* aqui";
    expect(renderMarkdown(sanitizeMarkdown(input))).toBe("Cliente: Maria, dado importante aqui");
  });
});
