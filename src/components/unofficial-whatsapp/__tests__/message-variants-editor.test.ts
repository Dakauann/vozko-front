import { describe, expect, it } from "vitest";

import {
  parameterCountIn,
  placeholdersIn,
  variantsAgree,
} from "../message-variants-editor";

/**
 * These mirror domain/shared/message_body.go.
 *
 * The rules are duplicated in the browser deliberately — an operator has to be
 * told about a broken variant set while typing, not after a round trip — so the
 * two implementations have to agree, and these are the cases that pin it.
 *
 * The campaign composer's own test file exercises the same functions through
 * its re-exports, which is what proves the extraction changed no behaviour.
 */

describe("parameterCountIn", () => {
  it("is the highest placeholder, not the count", () => {
    // A gap matters: {{1}} and {{3}} needs three columns, not two.
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
    // {{1}} is the lead's name, and whether any variant uses it decides which
    // rows get seeded plain instead of scripted.
    expect(placeholdersIn("Oi {{1}}, tudo bem?")).toContain(1);
    expect(placeholdersIn("Oi, tudo bem?")).toEqual([]);
  });

  it("refuses an opening whose variants ask for different variables", () => {
    // The server refuses this with a 400, so the dialog has to refuse it too,
    // or the preview promises an outcome the import will not deliver.
    expect(variantsAgree(["Oi {{1}}", "Oi {{2}}"])).toBe(false);
    expect(variantsAgree(["Oi {{1}}", "Ola {{1}}"])).toBe(true);
  });

  it("treats a single opening as always agreeing with itself", () => {
    expect(variantsAgree(["Oi {{1}}"])).toBe(true);
    expect(variantsAgree([])).toBe(true);
  });
});
