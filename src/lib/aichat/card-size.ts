export interface CardSize {
  width: number;
  height: number;
}

export const DEFAULT_CARD_SIZE: CardSize = { width: 480, height: 720 };
export const MIN_CARD_SIZE: CardSize = { width: 360, height: 420 };
export const VIEWPORT_MARGIN = 48;

function clampAxis(value: number, min: number, viewport: number): number {
  const max = Math.max(min, viewport - VIEWPORT_MARGIN);
  return Math.round(Math.min(Math.max(value, min), max));
}

export function clampCardSize(size: CardSize, viewport: CardSize): CardSize {
  return {
    width: clampAxis(size.width, MIN_CARD_SIZE.width, viewport.width),
    height: clampAxis(size.height, MIN_CARD_SIZE.height, viewport.height),
  };
}

export function parseStoredSize(raw: string | null): CardSize | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { width, height } = parsed as Record<string, unknown>;
    if (typeof width !== "number" || typeof height !== "number" || width <= 0 || height <= 0) return null;
    return { width, height };
  } catch {
    return null;
  }
}
