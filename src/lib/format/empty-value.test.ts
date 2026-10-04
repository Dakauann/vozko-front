import { describe, expect, it } from "vitest";

import { emptyValue } from "./empty-value";

describe("emptyValue", () => {
  it("says the value is not available in the language of the locale", () => {
    expect(emptyValue("pt-BR")).toBe("n/d");
    expect(emptyValue("pt")).toBe("n/d");
    expect(emptyValue("en-US")).toBe("n/a");
    expect(emptyValue("es")).toBe("n/d");
    expect(emptyValue("de-DE")).toBe("k. A.");
  });

  it("falls back to english for a language the product does not ship", () => {
    expect(emptyValue("fr-FR")).toBe("n/a");
  });

  it("never uses a dash", () => {
    for (const tag of ["pt-BR", "en-US", "es", "de-DE"]) expect(emptyValue(tag)).not.toMatch(/[–—-]/);
  });
});
