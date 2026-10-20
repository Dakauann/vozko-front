import { describe, expect, it } from "vitest";
import { GitBranch, PaperPlaneTilt } from "@/components/icons";
import { ICON_MAP, nodeIconOf } from "./workflow-node";

describe("nodeIconOf", () => {
  it("resolves the form trigger icon the backend sends", () => {
    expect(nodeIconOf("ClipboardText")).toBe(ICON_MAP.ClipboardText);
    expect(ICON_MAP.ClipboardText).toBeDefined();
  });

  it("never leaves a node without an icon when the backend sends an unknown name", () => {
    expect(nodeIconOf("IconTheFrontendDoesNotKnow")).toBe(PaperPlaneTilt);
    expect(nodeIconOf(undefined)).toBe(PaperPlaneTilt);
    expect(nodeIconOf("", GitBranch)).toBe(GitBranch);
  });

  it("keeps resolving every icon already in the map", () => {
    for (const [name, icon] of Object.entries(ICON_MAP)) {
      expect(nodeIconOf(name)).toBe(icon);
    }
  });
});
