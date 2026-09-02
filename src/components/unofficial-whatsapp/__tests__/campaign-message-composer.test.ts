import { describe, expect, it } from "vitest";

import {
  parameterCount,
  placeholdersIn,
  variantsAgree,
} from "../campaign-message-composer";
import type { UnofficialWhatsAppMessageSpec } from "@/lib/unofficial-whatsapp-campaigns/types";

const spec = (...bodies: string[]): UnofficialWhatsAppMessageSpec => ({
  kind: "text",
  bodies,
});

/**
 * These mirror MessageSpec in the Go domain.
 *
 * They are duplicated in the browser deliberately — the operator has to be told
 * about a broken variant set while typing, not after a round trip — so the two
 * implementations have to agree, and these are the cases that pin that.
 */
describe("placeholder detection", () => {
  it("finds positional variables and ignores named ones", () => {
    expect(placeholdersIn("oi {{1}} e {{2}}")).toEqual([1, 2]);
    // Named placeholders are the PROVIDER's syntax, substituted from its own
    // lead store. We never render them, so they are not ours to count.
    expect(placeholdersIn("use {{nome}}")).toEqual([]);
  });

  it("deduplicates a repeated variable", () => {
    expect(placeholdersIn("{{1}} e {{1}} de novo")).toEqual([1]);
  });

  it("returns them in ascending order regardless of where they appear", () => {
    expect(placeholdersIn("{{3}} depois {{1}}")).toEqual([1, 3]);
  });
});

describe("parameterCount", () => {
  it("is the highest placeholder, not the count", () => {
    // A gap matters: {{1}} and {{3}} needs three columns, not two.
    expect(parameterCount(spec("oi {{1}} e {{3}}"))).toBe(3);
  });

  it("spans every variant, because the importer collects one set of columns", () => {
    expect(parameterCount(spec("oi {{1}}", "ola {{1}} do {{2}}"))).toBe(2);
  });

  it("is zero for a message with no variables", () => {
    expect(parameterCount(spec("bom dia"))).toBe(0);
  });
});

describe("variantsAgree", () => {
  it("accepts a single body", () => {
    expect(variantsAgree(spec("bom dia"))).toBe(true);
  });

  it("accepts variants using the same variables in any order", () => {
    expect(variantsAgree(spec("{{1}} {{2}}", "{{2}}, {{1}}"))).toBe(true);
  });

  it("rejects the same COUNT of different variables", () => {
    // The trap this exists for: one variant reading {{1}} beside one reading
    // {{2}} would send a raw "{{2}}" to everyone assigned the second, because
    // the importer only collected one column.
    expect(variantsAgree(spec("oi {{1}}", "ola {{2}}"))).toBe(false);
  });

  it("rejects a variant that uses a variable the others do not", () => {
    expect(variantsAgree(spec("oi {{1}}", "ola {{1}} de {{2}}"))).toBe(false);
  });
});
