import type { EntryType } from "./types";


export const MIN_WINDOW_WIDTH = 320;
export const MIN_WINDOW_HEIGHT = 320;

const WIDTH_SHARE = 0.27;
const HEIGHT_SHARE = 0.66;
export const MAX_DEFAULT_WINDOW_WIDTH = 460;
export const MAX_DEFAULT_WINDOW_HEIGHT = 720;

export function defaultWindowSize(viewport: Viewport): {
  width: number;
  height: number;
} {
  return {
    width: Math.round(
      Math.max(
        Math.min(viewport.width - GAP * 2, MIN_WINDOW_WIDTH),
        Math.min(viewport.width * WIDTH_SHARE, MAX_DEFAULT_WINDOW_WIDTH),
      ),
    ),
    height: Math.round(
      Math.max(
        Math.min(viewport.height - GAP * 2, MIN_WINDOW_HEIGHT),
        Math.min(viewport.height * HEIGHT_SHARE, MAX_DEFAULT_WINDOW_HEIGHT),
      ),
    ),
  };
}

export const MINIMIZED_WINDOW_HEIGHT = 52;

export const MINIMIZED_WINDOW_WIDTH = 260;

export const MAX_OPEN_WINDOWS = 4;

const GAP = 12;

const CASCADE_STEP = 32;

export interface Viewport {
  width: number;
  height: number;
}

export interface WindowBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ConversationWindow extends WindowBox {
  key: string;
  entryId: string;
  entryType: EntryType;
  leadName: string;
  minimized: boolean;
  maximized: boolean;
  restore: WindowBox | null;
  slotIndex?: number;
  z: number;
}

export interface WindowDeck {
  windows: ConversationWindow[];
  nextZ: number;
}

export interface OpenWindowInput {
  entryId: string;
  entryType: EntryType;
  leadName?: string;
}

export function windowKey(entryId: string, entryType: EntryType | string) {
  return `${entryType}-${entryId}`;
}

export function emptyDeck(): WindowDeck {
  return { windows: [], nextZ: 1 };
}

export function isWindowOpen(deck: WindowDeck, key: string) {
  return deck.windows.some((w) => w.key === key);
}

export function findWindow(deck: WindowDeck, key: string) {
  return deck.windows.find((w) => w.key === key) ?? null;
}

function clampBox(box: WindowBox, viewport: Viewport): WindowBox {
  const width = Math.max(
    Math.min(box.width, Math.max(viewport.width - GAP * 2, MIN_WINDOW_WIDTH)),
    Math.min(MIN_WINDOW_WIDTH, viewport.width),
  );
  const height = Math.max(
    Math.min(box.height, Math.max(viewport.height - GAP * 2, MIN_WINDOW_HEIGHT)),
    Math.min(MIN_WINDOW_HEIGHT, viewport.height),
  );
  return {
    width,
    height,
    x: Math.max(0, Math.min(box.x, viewport.width - width)),
    y: Math.max(0, Math.min(box.y, viewport.height - height)),
  };
}

function boxForSlot(slot: number, viewport: Viewport): WindowBox {
  const { width, height } = defaultWindowSize(viewport);
  const perRow = Math.max(1, Math.floor((viewport.width - GAP) / (width + GAP)));
  const column = slot % perRow;
  const row = Math.floor(slot / perRow);

  return clampBox(
    {
      width,
      height,
      x:
        viewport.width -
        GAP -
        (column + 1) * width -
        column * GAP -
        row * CASCADE_STEP,
      y: viewport.height - GAP - height - row * CASCADE_STEP,
    },
    viewport,
  );
}

function firstFreeSlot(deck: WindowDeck, viewport: Viewport): number {
  const taken = new Set(deck.windows.map((w) => w.slotIndex ?? -1));
  for (let slot = 0; slot < MAX_OPEN_WINDOWS; slot++) {
    if (!taken.has(slot)) return slot;
  }
  void viewport;
  return deck.windows.length;
}

export function openWindow(
  deck: WindowDeck,
  input: OpenWindowInput,
  viewport: Viewport,
): WindowDeck {
  const key = windowKey(input.entryId, input.entryType);
  const existing = findWindow(deck, key);

  if (existing) {
    const raised = raise(deck, key);
    if (!existing.minimized && raised === deck) return deck;
    return {
      ...raised,
      windows: raised.windows.map((w) =>
        w.key === key
          ? {
              ...w,
              minimized: false,
              leadName: input.leadName || w.leadName,
            }
          : w,
      ),
    };
  }

  const slot = firstFreeSlot(deck, viewport);
  const box = boxForSlot(slot, viewport);

  return {
    nextZ: deck.nextZ + 1,
    windows: [
      ...deck.windows,
      {
        key,
        entryId: input.entryId,
        entryType: input.entryType,
        leadName: input.leadName ?? "",
        minimized: false,
        maximized: false,
        restore: null,
        slotIndex: slot,
        z: deck.nextZ,
        ...box,
      },
    ],
  };
}

export function closeWindow(deck: WindowDeck, key: string): WindowDeck {
  if (!isWindowOpen(deck, key)) return deck;
  return { ...deck, windows: deck.windows.filter((w) => w.key !== key) };
}

export function closeAllWindows(deck: WindowDeck): WindowDeck {
  return deck.windows.length === 0 ? deck : { ...deck, windows: [] };
}

function raise(deck: WindowDeck, key: string): WindowDeck {
  const target = findWindow(deck, key);
  if (!target) return deck;
  const topZ = Math.max(...deck.windows.map((w) => w.z));
  if (target.z === topZ) return deck;

  return {
    nextZ: deck.nextZ + 1,
    windows: deck.windows.map((w) =>
      w.key === key ? { ...w, z: deck.nextZ } : w,
    ),
  };
}

export function focusWindow(deck: WindowDeck, key: string): WindowDeck {
  return raise(deck, key);
}

export function setMinimized(
  deck: WindowDeck,
  key: string,
  minimized: boolean,
): WindowDeck {
  const target = findWindow(deck, key);
  if (!target || target.minimized === minimized) return deck;

  const base = minimized ? deck : raise(deck, key);
  return {
    ...base,
    windows: base.windows.map((w) => (w.key === key ? { ...w, minimized } : w)),
  };
}

export function toggleMaximized(
  deck: WindowDeck,
  key: string,
  viewport: Viewport,
): WindowDeck {
  const target = findWindow(deck, key);
  if (!target) return deck;

  const base = raise(deck, key);

  if (target.maximized) {
    const restore = target.restore ?? {
      x: target.x,
      y: target.y,
      ...defaultWindowSize(viewport),
    };
    return {
      ...base,
      windows: base.windows.map((w) =>
        w.key === key
          ? { ...w, maximized: false, restore: null, ...clampBox(restore, viewport) }
          : w,
      ),
    };
  }

  const full: WindowBox = {
    x: GAP,
    y: GAP,
    width: viewport.width - GAP * 2,
    height: viewport.height - GAP * 2,
  };

  return {
    ...base,
    windows: base.windows.map((w) =>
      w.key === key
        ? {
            ...w,
            maximized: true,
            minimized: false,
            restore: { x: w.x, y: w.y, width: w.width, height: w.height },
            ...clampBox(full, viewport),
          }
        : w,
    ),
  };
}

export function moveWindow(
  deck: WindowDeck,
  key: string,
  position: { x: number; y: number },
  viewport: Viewport,
): WindowDeck {
  const target = findWindow(deck, key);
  if (!target) return deck;

  const box = clampBox({ ...target, ...position }, viewport);
  if (box.x === target.x && box.y === target.y) return deck;

  return {
    ...deck,
    windows: deck.windows.map((w) =>
      w.key === key ? { ...w, ...box, maximized: false, slotIndex: undefined } : w,
    ),
  };
}

export function resizeWindow(
  deck: WindowDeck,
  key: string,
  size: { width: number; height: number },
  viewport: Viewport,
): WindowDeck {
  const target = findWindow(deck, key);
  if (!target) return deck;

  const box = clampBox(
    {
      x: target.x,
      y: target.y,
      width: Math.max(size.width, MIN_WINDOW_WIDTH),
      height: Math.max(size.height, MIN_WINDOW_HEIGHT),
    },
    viewport,
  );
  if (box.width === target.width && box.height === target.height) return deck;

  return {
    ...deck,
    windows: deck.windows.map((w) =>
      w.key === key ? { ...w, ...box, maximized: false } : w,
    ),
  };
}

export function dockedBoxes(
  deck: WindowDeck,
  viewport: Viewport,
): Map<string, WindowBox> {
  const boxes = new Map<string, WindowBox>();
  const width = Math.min(MINIMIZED_WINDOW_WIDTH, viewport.width - GAP * 2);
  const perRow = Math.max(1, Math.floor((viewport.width - GAP) / (width + GAP)));

  deck.windows
    .filter((w) => w.minimized)
    .forEach((w, index) => {
      const column = index % perRow;
      const row = Math.floor(index / perRow);
      boxes.set(w.key, {
        width,
        height: MINIMIZED_WINDOW_HEIGHT,
        x: Math.max(
          0,
          viewport.width - GAP - (column + 1) * width - column * GAP,
        ),
        y: Math.max(
          0,
          viewport.height -
            GAP -
            MINIMIZED_WINDOW_HEIGHT -
            row * (MINIMIZED_WINDOW_HEIGHT + GAP),
        ),
      });
    });

  return boxes;
}

export function dockHeight(deck: WindowDeck): number {
  const minimized = deck.windows.filter((w) => w.minimized).length;
  if (minimized === 0) return 0;
  return MINIMIZED_WINDOW_HEIGHT + GAP * 2;
}

export function clampDeckToViewport(
  deck: WindowDeck,
  viewport: Viewport,
): WindowDeck {
  let changed = false;
  const windows = deck.windows.map((w) => {
    const box = w.maximized
      ? clampBox(
          {
            x: GAP,
            y: GAP,
            width: viewport.width - GAP * 2,
            height: viewport.height - GAP * 2,
          },
          viewport,
        )
      : clampBox(w, viewport);
    if (
      box.x === w.x &&
      box.y === w.y &&
      box.width === w.width &&
      box.height === w.height
    ) {
      return w;
    }
    changed = true;
    return { ...w, ...box };
  });

  return changed ? { ...deck, windows } : deck;
}
