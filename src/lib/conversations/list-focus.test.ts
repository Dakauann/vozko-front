import { describe, expect, it } from "vitest";

import { moveListFocus, rovingStop } from "./list-focus";

const keys = ["whatsapp-a", "whatsapp-b", "instagram-c"];

describe("moving the focused row", () => {
  it("steps down and up one row at a time", () => {
    expect(moveListFocus(keys, "whatsapp-a", 1)).toBe("whatsapp-b");
    expect(moveListFocus(keys, "whatsapp-b", -1)).toBe("whatsapp-a");
  });

  it("stops at the ends instead of wrapping, so holding j never jumps back to the top", () => {
    expect(moveListFocus(keys, "instagram-c", 1)).toBe("instagram-c");
    expect(moveListFocus(keys, "whatsapp-a", -1)).toBe("whatsapp-a");
  });

  it("starts from the first row when nothing has focus yet", () => {
    expect(moveListFocus(keys, null, 1)).toBe("whatsapp-a");
    expect(moveListFocus(keys, null, -1)).toBe("whatsapp-a");
  });

  it("restarts from the top when the focused row left the list", () => {
    expect(moveListFocus(keys, "telegram-gone", 1)).toBe("whatsapp-a");
  });

  it("has nothing to focus in an empty list", () => {
    expect(moveListFocus([], "whatsapp-a", 1)).toBeNull();
  });

  it("follows the row, not the position, when the list reorders", () => {
    const reordered = ["instagram-c", "whatsapp-a", "whatsapp-b"];
    expect(moveListFocus(reordered, "whatsapp-a", 1)).toBe("whatsapp-b");
  });
});

describe("the single tab stop of the list", () => {
  it("is the focused row while it is still listed", () => {
    expect(rovingStop(keys, "whatsapp-b", "instagram-c")).toBe("whatsapp-b");
  });

  it("falls back to the open conversation, then to the first row", () => {
    expect(rovingStop(keys, null, "instagram-c")).toBe("instagram-c");
    expect(rovingStop(keys, "telegram-gone", null)).toBe("whatsapp-a");
    expect(rovingStop(keys, null, "telegram-gone")).toBe("whatsapp-a");
  });

  it("does not exist in an empty list", () => {
    expect(rovingStop([], "whatsapp-a", "whatsapp-a")).toBeNull();
  });
});
