import type { EntryType } from "./types";

/**
 * The deck of floating conversation windows.
 *
 * Geometry only — which conversations are open, where their boxes sit, and
 * which one is on top. Message state belongs to windowed-conversations; keeping
 * the two apart is what lets a drag re-render without touching a transcript,
 * and lets both be tested without a socket or a DOM.
 *
 * Every operation is pure and returns the SAME deck object when nothing
 * changed, so a caller holding it in React state gets a free bail-out.
 */

export const MIN_WINDOW_WIDTH = 320;
export const MIN_WINDOW_HEIGHT = 320;

/**
 * How large a window opens, as a share of the display.
 *
 * Fixed pixels do not survive the range of screens this runs on: 384x540 is a
 * sensible column on a 1440 laptop and a postage stamp on a 2560 desk, where it
 * leaves a conversation reading in a sliver while two thirds of the screen sits
 * empty. The share is bounded at both ends so it stays a window rather than
 * becoming a full-screen takeover on a very wide display or an unreadable strip
 * on a small one.
 */
const WIDTH_SHARE = 0.27;
const HEIGHT_SHARE = 0.66;
export const MAX_DEFAULT_WINDOW_WIDTH = 460;
export const MAX_DEFAULT_WINDOW_HEIGHT = 720;

/** The size a window opens at on this viewport. */
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

/**
 * Height of the bar a minimized window collapses to.
 *
 * Sized off the avatar it carries, not picked by eye: the 32px circle hangs a
 * channel badge 8px below itself, so a centred avatar needs 32 + 8*2 = 48 to
 * keep that badge inside the bar. At 44 the badge was sliced off, which read as
 * a rendering fault rather than as a design. The rest is breathing room.
 */
export const MINIMIZED_WINDOW_HEIGHT = 52;

/**
 * How wide a parked conversation is.
 *
 * A minimized window is a NAME waiting to be clicked, not a conversation, so it
 * is capped well below a real window: parking three of them must leave the
 * screen readable rather than replacing one wall of chat with another.
 */
export const MINIMIZED_WINDOW_WIDTH = 260;

/**
 * Four at once.
 *
 * Not a technical limit — the socket would carry more — but a legibility one:
 * a fifth 384px column does not fit beside four on a 1440 desk without
 * overlapping, and an operator reading five live conversations is not reading
 * any of them. Opening a fifth retires the one opened longest ago.
 *
 * Declared here, next to the widths that justify the number, but ENFORCED
 * where the list of open conversations lives (the socket hook), because that
 * is the list a window is derived from. Capping in both places would have the
 * two disagree: the deck would retire a box for a conversation still open, and
 * then rebuild it on the next render, forever.
 */
export const MAX_OPEN_WINDOWS = 4;

/** Breathing room from the viewport edges and between two windows. */
const GAP = 12;

/**
 * How far a window that could not fit the bottom row is offset from it.
 *
 * A full second row does not fit — two 540px windows need 1100px of height —
 * so the overflow cascades instead of tiling, the way a window manager does.
 * Stepping by a full height would clamp back onto the first row and place one
 * window exactly on top of another, which reads as a single window that has
 * lost its neighbour.
 */
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
  /** Shown in the title bar before `conversation:subscribed` names the lead. */
  leadName: string;
  minimized: boolean;
  maximized: boolean;
  /** The box to restore to when un-maximizing. */
  restore: WindowBox | null;
  /**
   * Which tile of the default bottom row this window took, so a later open
   * refills the gap a close left. Cleared once the operator drags it, because
   * a hand-placed window is no longer part of the row.
   */
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

/**
 * Where the next window goes: a row along the bottom, filling right to left.
 *
 * `slot` is the first index no open window is sitting in, so closing the
 * middle window and opening another puts the new one back in the hole rather
 * than off the left edge.
 */
function boxForSlot(slot: number, viewport: Viewport): WindowBox {
  const { width, height } = defaultWindowSize(viewport);
  const perRow = Math.max(1, Math.floor((viewport.width - GAP) / (width + GAP)));
  const column = slot % perRow;
  const row = Math.floor(slot / perRow);

  return clampBox(
    {
      width,
      height,
      // The row fills right to left; anything past it steps up and to the left
      // so it stays distinguishable from the window it would have covered.
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

  // Already open: this is "bring it forward", not "open a second copy of the
  // same conversation" — two live views of one thread is a bug, not a feature.
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

  // Coming back from the bar means the operator wants to read it, so it comes
  // back on TOP rather than behind whatever was opened while it was away.
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
      // A dragged window leaves the tiled row, so it releases its slot: the
      // next one opened fills the gap it used to occupy rather than landing
      // under it.
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

/**
 * Where each minimized conversation is parked: a strip along the bottom edge,
 * filling right to left.
 *
 * Deliberately NOT stored on the window. A minimized window keeps its own box
 * untouched, so restoring it puts it back exactly where the operator left it
 * rather than somewhere the dock decided.
 */
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

/**
 * How much room the page must leave at its bottom edge so the dock covers
 * nothing.
 *
 * The dock is fixed to the viewport, so without this it would sit on top of the
 * centre pane's composer — the one control an operator needs most.
 */
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
