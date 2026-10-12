import { describe, expect, it } from "vitest";

import { revealScroll, revealTarget, timelineWheel, type WheelInput } from "./timeline-scroll";

const PAGE_PX = 600;

function wheel(input: Partial<WheelInput>): WheelInput {
  return { deltaX: 0, deltaY: 0, deltaMode: 0, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...input };
}

describe("timelineWheel", () => {
  it("leaves the plain wheel and trackpad swipes to the native scroll, so tracks scroll down and swipes go sideways", () => {
    expect(timelineWheel(wheel({ deltaY: 100 }), PAGE_PX)).toEqual({ kind: "native" });
    expect(timelineWheel(wheel({ deltaX: 30, deltaY: 4 }), PAGE_PX)).toEqual({ kind: "native" });
  });

  it("turns Shift with a vertical wheel into a sideways scroll", () => {
    expect(timelineWheel(wheel({ deltaY: 100, shiftKey: true }), PAGE_PX)).toEqual({ kind: "horizontal", px: 100 });
    expect(timelineWheel(wheel({ deltaY: -3, deltaMode: 1, shiftKey: true }), PAGE_PX)).toEqual({ kind: "horizontal", px: -120 });
    expect(timelineWheel(wheel({ deltaY: 1, deltaMode: 2, shiftKey: true }), PAGE_PX)).toEqual({ kind: "horizontal", px: PAGE_PX });
  });

  it("keeps the native scroll when the browser already turned Shift into a sideways delta", () => {
    expect(timelineWheel(wheel({ deltaX: 100, shiftKey: true }), PAGE_PX)).toEqual({ kind: "native" });
  });

  it("zooms with Ctrl, Cmd, Alt and the trackpad pinch, one step per wheel notch and less for a pinch", () => {
    expect(timelineWheel(wheel({ deltaY: -100, ctrlKey: true }), PAGE_PX)).toEqual({ kind: "zoom", steps: 1 });
    expect(timelineWheel(wheel({ deltaY: 100, metaKey: true }), PAGE_PX)).toEqual({ kind: "zoom", steps: -1 });
    expect(timelineWheel(wheel({ deltaY: -480, altKey: true }), PAGE_PX)).toEqual({ kind: "zoom", steps: 1 });
    expect(timelineWheel(wheel({ deltaY: 10, ctrlKey: true }), PAGE_PX)).toEqual({ kind: "zoom", steps: -0.1 });
    expect(timelineWheel(wheel({ deltaY: -3, deltaMode: 1, ctrlKey: true }), PAGE_PX)).toEqual({ kind: "zoom", steps: 1 });
  });

  it("does not zoom on a sideways pinch with no vertical delta", () => {
    expect(timelineWheel(wheel({ deltaX: 20, ctrlKey: true }), PAGE_PX)).toEqual({ kind: "zoom", steps: 0 });
  });
});

describe("revealScroll", () => {
  const view = { scrollTop: 0, scrollLeft: 0, width: 800, height: 200 };

  it("does nothing when the lane and the clip are already in view", () => {
    expect(revealScroll({ top: 40, height: 56, left: 100, width: 200 }, view)).toEqual({ top: null, left: null });
  });

  it("scrolls down just enough to show a lane below the view", () => {
    expect(revealScroll({ top: 300, height: 56, left: 100, width: 200 }, view)).toEqual({ top: 300 + 56 + 8 - 200, left: null });
  });

  it("scrolls up to a lane above the view", () => {
    expect(revealScroll({ top: 40, height: 56, left: 100, width: 200 }, { ...view, scrollTop: 300 })).toEqual({ top: 32, left: null });
  });

  it("shows the whole lane when only part of it is in view", () => {
    expect(revealScroll({ top: 180, height: 56, left: 100, width: 200 }, view).top).toBe(180 + 56 + 8 - 200);
  });

  it("aligns a lane taller than the view to its top unless it already fills the view", () => {
    expect(revealScroll({ top: 400, height: 500, left: 0, width: 10 }, view).top).toBe(392);
    expect(revealScroll({ top: 400, height: 500, left: 0, width: 10 }, { ...view, scrollTop: 500 }).top).toBeNull();
  });

  it("brings a clip outside the view back with a margin, and leaves a partly visible clip alone", () => {
    expect(revealScroll({ top: 0, height: 56, left: 2000, width: 300 }, view).left).toBe(2000 + 300 + 48 - 800);
    expect(revealScroll({ top: 0, height: 56, left: 100, width: 300 }, { ...view, scrollLeft: 1000 }).left).toBe(52);
    expect(revealScroll({ top: 0, height: 56, left: 700, width: 300 }, view).left).toBeNull();
    expect(revealScroll({ top: 0, height: 56, left: 3000, width: 2000 }, view).left).toBe(2952);
  });

  it("never scrolls before the start and does nothing before the view is measured", () => {
    expect(revealScroll({ top: 2, height: 56, left: 10, width: 30 }, { ...view, scrollTop: 100, scrollLeft: 900 })).toEqual({ top: 0, left: 0 });
    expect(revealScroll({ top: 900, height: 56, left: 9000, width: 30 }, { ...view, width: 0, height: 0 })).toEqual({ top: null, left: null });
  });
});

describe("revealTarget", () => {
  it("reveals the one clip that just joined the selection", () => {
    expect(revealTarget([], ["a"])).toBe("a");
    expect(revealTarget(["a"], ["b"])).toBe("b");
    expect(revealTarget(["a"], ["a", "b"])).toBe("b");
  });

  it("does not move the view when nothing joined or many joined at once", () => {
    expect(revealTarget(["a", "b"], ["a"])).toBeNull();
    expect(revealTarget(["a"], ["a"])).toBeNull();
    expect(revealTarget([], ["a", "b", "c"])).toBeNull();
  });
});
