import { describe, expect, it } from "vitest";

import {
  parameterCountIn,
  placeholdersIn,
  variantsAgree,
} from "../message-variants-editor";


describe("parameterCountIn", () => {
  it("is the highest placeholder, not the count", () => {
    expect(parameterCountIn(["oi {{1}} e {{3}}"])).toBe(3);
  });

  it("spans every variant, because one set of columns is collected", () => {
    expect(parameterCountIn(["oi {{1}}", "ola {{1}} do {{2}}"])).toBe(2);
  });

  it("is zero for no variables and for no bodies", () => {
    expect(parameterCountIn(["bom dia"])).toBe(0);
    expect(parameterCountIn([])).toBe(0);
  });
});

describe("the lead import's own use of these", () => {
  it("detects the name placeholder the seeded opening renders", () => {
    expect(placeholdersIn("Oi {{1}}, tudo bem?")).toContain(1);
    expect(placeholdersIn("Oi, tudo bem?")).toEqual([]);
  });

  it("refuses an opening whose variants ask for different variables", () => {
    expect(variantsAgree(["Oi {{1}}", "Oi {{2}}"])).toBe(false);
    expect(variantsAgree(["Oi {{1}}", "Ola {{1}}"])).toBe(true);
  });

  it("treats a single opening as always agreeing with itself", () => {
    expect(variantsAgree(["Oi {{1}}"])).toBe(true);
    expect(variantsAgree([])).toBe(true);
  });
});
