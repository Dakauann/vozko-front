import { describe, expect, it } from "vitest";

import { readViewMode, withViewMode } from "../view-mode";

describe("the CRM view mode in the address", () => {
  it("reads a known view mode", () => {
    expect(readViewMode("?mode=funnel")).toBe("funnel");
    expect(readViewMode("?g=stage&mode=table")).toBe("table");
  });

  it("falls back to nothing for a missing or unknown mode", () => {
    expect(readViewMode("")).toBeNull();
    expect(readViewMode("?mode=gallery")).toBeNull();
  });

  it("writes the mode beside the other params and leaves the default out", () => {
    const params = new URLSearchParams(withViewMode("?g=stage&entry=e-1&type=whatsapp", "funnel"));
    expect(params.get("mode")).toBe("funnel");
    expect(params.get("g")).toBe("stage");
    expect(params.get("entry")).toBe("e-1");
    expect(withViewMode("?g=stage&mode=table", "classic")).toBe("?g=stage");
  });
});
