import { describe, expect, it } from "vitest";

import { filenameFromDisposition } from "./download";

describe("filenameFromDisposition", () => {
  it("reads the file name the server chose, quoted or not", () => {
    expect(filenameFromDisposition('attachment; filename="Mensal-2026-09-01-2026-09-30.csv"')).toBe("Mensal-2026-09-01-2026-09-30.csv");
    expect(filenameFromDisposition("attachment; filename=anuncios.csv")).toBe("anuncios.csv");
  });

  it("has no name without the header", () => {
    expect(filenameFromDisposition(null)).toBeNull();
    expect(filenameFromDisposition("inline")).toBeNull();
  });
});
