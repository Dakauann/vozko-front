import { describe, expect, it } from "vitest";

import { ELEMENT_PROMPT_LIMIT, ELEMENT_STYLES, elementPrompt, elementStyleFor } from "./element-prompt";

describe("element prompts", () => {
  it("ask for one isolated subject on a plain background, ready for background removal", () => {
    for (const style of ELEMENT_STYLES) {
      const prompt = elementPrompt("  um   foguete  ", style)!;
      expect(prompt.startsWith("um foguete. A single isolated subject")).toBe(true);
      expect(prompt).toContain("plain solid light gray background");
      expect(prompt).toContain("no text");
    }
  });

  it("refuse an empty description and keep long ones within the limit", () => {
    expect(elementPrompt("   ", "photo")).toBeNull();
    expect(elementPrompt("a".repeat(ELEMENT_PROMPT_LIMIT * 2), "sticker")!.startsWith(`${"a".repeat(ELEMENT_PROMPT_LIMIT)}.`)).toBe(true);
  });

  it("draw the 3D category in 3D and everything else as an illustration", () => {
    expect(elementStyleFor("threeD")).toBe("threeD");
    expect(elementStyleFor("graphics")).toBe("illustration");
  });
});
