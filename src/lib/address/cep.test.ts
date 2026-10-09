import { describe, expect, it } from "vitest";

import { formatCep } from "./cep";

describe("formatCep", () => {
  it("writes a CEP the way people read it", () => {
    expect(formatCep("06402000")).toBe("06402-000");
    expect(formatCep("06402-000")).toBe("06402-000");
  });

  it("leaves text that is not a CEP as it came", () => {
    expect(formatCep("0640")).toBe("0640");
  });
});
