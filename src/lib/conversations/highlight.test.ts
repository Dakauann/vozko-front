import { describe, expect, it } from "vitest";

import { highlightParts } from "./highlight";

describe("splitting text around the search term", () => {
  it("marks every match, ignoring case", () => {
    expect(highlightParts("Ana e ANA", "ana")).toEqual([
      { text: "Ana", match: true },
      { text: " e ", match: false },
      { text: "ANA", match: true },
    ]);
  });

  it("keeps the original casing of the text", () => {
    expect(highlightParts("Pedido 123", "PEDIDO")[0]).toEqual({ text: "Pedido", match: true });
  });

  it("returns the text whole when the term is shorter than the search minimum or absent", () => {
    expect(highlightParts("Maria", "m")).toEqual([{ text: "Maria", match: false }]);
    expect(highlightParts("Maria", "  ")).toEqual([{ text: "Maria", match: false }]);
    expect(highlightParts("Maria", "joão")).toEqual([{ text: "Maria", match: false }]);
  });

  it("ignores spaces around the term", () => {
    expect(highlightParts("oi maria", " maria ")).toEqual([
      { text: "oi ", match: false },
      { text: "maria", match: true },
    ]);
  });

  it("has no parts for empty text", () => {
    expect(highlightParts("", "maria")).toEqual([]);
  });
});
