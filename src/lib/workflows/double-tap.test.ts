import { describe, expect, it } from "vitest";

import { DOUBLE_TAP_MS, createDoubleTap, isMouseClick } from "./double-tap";

describe("isMouseClick", () => {
  it("recognises a mouse click, which already gets a native double click", () => {
    expect(isMouseClick(new PointerEvent("click", { pointerType: "mouse" }))).toBe(true);
  });

  it("treats touch, pen and clicks without a pointer type as taps, since those may never get a double click", () => {
    expect(isMouseClick(new PointerEvent("click", { pointerType: "touch" }))).toBe(false);
    expect(isMouseClick(new PointerEvent("click", { pointerType: "pen" }))).toBe(false);
    expect(isMouseClick(new MouseEvent("click"))).toBe(false);
  });
});

describe("createDoubleTap", () => {
  it("treats a second tap on the same node inside the window as a double tap", () => {
    const tap = createDoubleTap();
    expect(tap("n1", 1000)).toBe(false);
    expect(tap("n1", 1000 + DOUBLE_TAP_MS)).toBe(true);
  });

  it("ignores a second tap that comes too late, so slow taps only select", () => {
    const tap = createDoubleTap();
    expect(tap("n1", 1000)).toBe(false);
    expect(tap("n1", 1001 + DOUBLE_TAP_MS)).toBe(false);
  });

  it("ignores taps on two different nodes, so tapping across nodes never opens one", () => {
    const tap = createDoubleTap();
    expect(tap("n1", 1000)).toBe(false);
    expect(tap("n2", 1050)).toBe(false);
  });

  it("starts over after a double tap, so a third quick tap is not another double tap", () => {
    const tap = createDoubleTap();
    tap("n1", 1000);
    expect(tap("n1", 1100)).toBe(true);
    expect(tap("n1", 1200)).toBe(false);
  });
});
