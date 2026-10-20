import { describe, expect, it } from "vitest";

import { mercadoLivreErrorKey } from "@/lib/mercadolivre/errors";
import { MERCADOLIVRE_ERROR_CODES } from "@/lib/mercadolivre/types";

describe("mercadoLivreErrorKey", () => {
  it("names a copy key for every code the backend returns", () => {
    for (const code of MERCADOLIVRE_ERROR_CODES) expect(mercadoLivreErrorKey(code)).toBe(`errors.${code}`);
  });

  it("falls back to the generic copy for anything else", () => {
    expect(mercadoLivreErrorKey(undefined)).toBe("errors.generic");
    expect(mercadoLivreErrorKey("totally_new")).toBe("errors.generic");
  });
});
