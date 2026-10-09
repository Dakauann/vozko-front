export const VIEWPORT_FILL_MIN_PX = 520;

export interface ViewportFillOffset {
  top: number;
  bottom: number;
}

export function viewportFillHeight(offset: ViewportFillOffset, minPx: number = VIEWPORT_FILL_MIN_PX): string {
  const used = Math.max(0, Math.ceil(offset.top + offset.bottom));
  return `max(${minPx}px, calc(100dvh - ${used}px))`;
}

export function documentTop(element: Element): number {
  return element.getBoundingClientRect().top + window.scrollY;
}

function pixels(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function trailingInset(element: Element | null): number {
  let inset = 0;
  for (let container = element?.parentElement ?? null; container; container = container.parentElement) {
    const style = window.getComputedStyle(container);
    inset += pixels(style.paddingBottom) + pixels(style.borderBottomWidth) + pixels(style.marginBottom);
  }
  return inset;
}
