import { describe, expect, it } from "vitest";

import { getDomainEdgeLabel } from "./workflow-graph";

describe("getDomainEdgeLabel", () => {
  it("returns undefined for unlabeled edges", () => {
    expect(getDomainEdgeLabel({ sourceHandle: undefined, label: undefined })).toBeUndefined();
    expect(getDomainEdgeLabel({ sourceHandle: "", label: "" })).toBeUndefined();
  });

  it("prefers the source handle when present", () => {
    expect(getDomainEdgeLabel({ sourceHandle: "success", label: "ignored" })).toBe("success");
  });

  it("falls back to the visible label when no source handle exists", () => {
    expect(getDomainEdgeLabel({ sourceHandle: undefined, label: "erro" })).toBe("erro");
  });
});