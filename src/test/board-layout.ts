import { act, fireEvent } from "@testing-library/react";

const COLUMN_WIDTH = 288;
const COLUMN_GAP = 12;
const COLUMN_HEIGHT = 600;
const CARD_TOP = 60;
const CARD_HEIGHT = 80;
const CARD_INSET = 10;

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function fixedAncestor(element: Element): HTMLElement | null {
  for (let node: Element | null = element; node; node = node.parentElement) {
    if ((node as HTMLElement).style?.position === "fixed") return node as HTMLElement;
  }
  return null;
}

function overlayRect(overlay: HTMLElement): DOMRect {
  const { left, top, width, height } = overlay.style;
  return rect(parseFloat(left) || 0, parseFloat(top) || 0, parseFloat(width) || 0, parseFloat(height) || 0);
}

export function columnLeft(columnOrder: readonly string[], columnId: string): number {
  return columnOrder.indexOf(columnId) * (COLUMN_WIDTH + COLUMN_GAP);
}

export function fakeBoardLayout(columnOrder: readonly string[]) {
  return function boardRect(this: Element): DOMRect {
    const overlay = fixedAncestor(this);
    if (overlay) return overlayRect(overlay);
    const wrapped = this.firstElementChild?.firstElementChild?.getAttribute("data-column-id");
    const columnId = wrapped ?? this.closest("[data-column-id]")?.getAttribute("data-column-id");
    if (!columnId || !columnOrder.includes(columnId)) return rect(0, 0, 0, 0);
    const left = columnLeft(columnOrder, columnId);
    if (wrapped || this.hasAttribute("data-column-id")) {
      return rect(left, 0, COLUMN_WIDTH, COLUMN_HEIGHT);
    }
    return rect(left + CARD_INSET, CARD_TOP, COLUMN_WIDTH - 2 * CARD_INSET, CARD_HEIGHT);
  };
}

export async function flushTimers() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

export async function pressKey(target: HTMLElement, code: string, key: string = code) {
  fireEvent.keyDown(target, { key, code });
  await flushTimers();
}

export async function keyboardMove(card: HTMLElement, ...arrows: ("ArrowLeft" | "ArrowRight")[]) {
  card.focus();
  await pressKey(card, "Space", " ");
  for (const arrow of arrows) await pressKey(card, arrow);
  await pressKey(card, "Space", " ");
}
