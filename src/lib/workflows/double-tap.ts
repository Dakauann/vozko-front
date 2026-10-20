export const DOUBLE_TAP_MS = 350;

export type DoubleTap = (key: string, at: number) => boolean;

export function createDoubleTap(windowMs: number = DOUBLE_TAP_MS): DoubleTap {
  let last: { key: string; at: number } | null = null;
  return (key, at) => {
    const double = last !== null && last.key === key && at - last.at <= windowMs;
    last = double ? null : { key, at };
    return double;
  };
}

export function isMouseClick(event: Event): boolean {
  return "pointerType" in event && event.pointerType === "mouse";
}
