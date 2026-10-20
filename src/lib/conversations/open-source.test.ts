import { describe, expect, it } from "vitest";

import { focusesComposerOnOpen } from "./open-source";

describe("focusesComposerOnOpen", () => {
  it("leaves focus on the list when the conversation was opened from the keyboard, so j and k keep working", () => {
    expect(focusesComposerOnOpen("keyboard")).toBe(false);
  });

  it("focuses the composer when the conversation was opened with the pointer or from anywhere else", () => {
    expect(focusesComposerOnOpen("pointer")).toBe(true);
    expect(focusesComposerOnOpen(undefined)).toBe(true);
  });
});
