import { describe, expect, it } from "vitest";

import { metadataKeyOf } from "./metadata-key";

describe("metadataKeyOf", () => {
  it("keeps every letter of the label the person typed", () => {
    expect(metadataKeyOf("Nome Produto")).toBe("nome_produto");
    expect(metadataKeyOf("  Preço   Final ")).toBe("preco_final");
    expect(metadataKeyOf("Código-2")).toBe("codigo_2");
  });

  it("gives no key when nothing usable is left", () => {
    expect(metadataKeyOf("!!!")).toBeNull();
    expect(metadataKeyOf("   ")).toBeNull();
  });
});
