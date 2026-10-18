export interface WheelInput {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

type WheelIntent = { kind: "native" } | { kind: "horizontal"; px: number } | { kind: "zoom"; steps: number };

interface RevealBox {
  top: number;
  height: number;
  left: number;
  width: number;
}

interface RevealView {
  scrollTop: number;
  scrollLeft: number;
  width: number;
  height: number;
}

interface RevealOffsets {
  top: number | null;
  left: number | null;
}

const LINE_PX = 40;
const WHEEL_NOTCH_PX = 100;
const DELTA_LINE = 1;
const DELTA_PAGE = 2;
const REVEAL_MARGIN_Y = 8;
const REVEAL_MARGIN_X = 48;
const MIN_VISIBLE_X = 24;

function wheelPixels(delta: number, deltaMode: number, pagePx: number): number {
  if (deltaMode === DELTA_LINE) return delta * LINE_PX;
  if (deltaMode === DELTA_PAGE) return delta * pagePx;
  return delta;
}

export function timelineWheel(input: WheelInput, pagePx: number): WheelIntent {
  if (input.ctrlKey || input.metaKey || input.altKey) {
    const notches = -wheelPixels(input.deltaY, input.deltaMode, pagePx) / WHEEL_NOTCH_PX;
    return { kind: "zoom", steps: Math.max(-1, Math.min(1, notches)) || 0 };
  }
  if (input.shiftKey && input.deltaX === 0) return { kind: "horizontal", px: wheelPixels(input.deltaY, input.deltaMode, pagePx) };
  return { kind: "native" };
}

function revealAxis(start: number, size: number, scroll: number, viewport: number, margin: number, neededVisible: number): number | null {
  if (viewport <= 0) return null;
  const overlap = Math.min(start + size, scroll + viewport) - Math.max(start, scroll);
  if (overlap >= neededVisible) return null;
  if (start < scroll || size + margin * 2 > viewport) return Math.max(0, start - margin);
  return Math.max(0, start + size + margin - viewport);
}

export function revealScroll(box: RevealBox, view: RevealView): RevealOffsets {
  return {
    top: revealAxis(box.top, box.height, view.scrollTop, view.height, REVEAL_MARGIN_Y, Math.min(box.height, view.height)),
    left: revealAxis(box.left, box.width, view.scrollLeft, view.width, REVEAL_MARGIN_X, Math.min(box.width, view.width, MIN_VISIBLE_X)),
  };
}

export function revealTarget(previous: readonly string[], next: readonly string[]): string | null {
  const before = new Set(previous);
  const joined = next.filter((id) => !before.has(id));
  return joined.length === 1 ? joined[0] : null;
}
