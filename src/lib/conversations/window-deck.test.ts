import { describe, expect, it } from "vitest";

import {
  MAX_DEFAULT_WINDOW_WIDTH,
  MINIMIZED_WINDOW_HEIGHT,
  MINIMIZED_WINDOW_WIDTH,
  defaultWindowSize,
  dockHeight,
  dockedBoxes,
  MAX_OPEN_WINDOWS,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  clampDeckToViewport,
  closeWindow,
  emptyDeck,
  focusWindow,
  isWindowOpen,
  moveWindow,
  openWindow,
  resizeWindow,
  setMinimized,
  toggleMaximized,
  windowKey,
} from "@/lib/conversations/window-deck";

const viewport = { width: 1440, height: 900 };

const lead = (n: number) => ({
  entryId: `e${n}`,
  entryType: "whatsapp" as const,
  leadName: `Lead ${n}`,
});

describe("windowKey", () => {
  it("keys by type AND id, so two channels can share an id", () => {
    expect(windowKey("e1", "whatsapp")).not.toBe(windowKey("e1", "telegram"));
  });
});

describe("defaultWindowSize", () => {
  it("grows with the display instead of staying a fixed column", () => {
    const laptop = defaultWindowSize({ width: 1440, height: 900 });
    const desk = defaultWindowSize({ width: 2560, height: 1400 });

    expect(desk.width).toBeGreaterThan(laptop.width);
    expect(desk.height).toBeGreaterThan(laptop.height);
  });

  it("stops growing, so a window never becomes a full-screen takeover", () => {
    const huge = defaultWindowSize({ width: 5120, height: 2880 });

    expect(huge.width).toBe(MAX_DEFAULT_WINDOW_WIDTH);
    expect(huge.width).toBeLessThan(5120 / 2);
    expect(huge.height).toBeLessThan(2880 / 2);
  });

  it("stays readable on a small viewport", () => {
    const small = defaultWindowSize({ width: 900, height: 600 });

    expect(small.width).toBeGreaterThanOrEqual(MIN_WINDOW_WIDTH);
    expect(small.height).toBeGreaterThanOrEqual(MIN_WINDOW_HEIGHT);
    expect(small.height).toBeLessThanOrEqual(600);
  });

  // The reason the shares exist: a real 2349x905 desk (the one this was found
  // on) must not open a window that leaves the thread reading in a sliver.
  it("fills a wide, short desk sensibly", () => {
    const { width, height } = defaultWindowSize({ width: 2349, height: 905 });

    expect(width).toBe(MAX_DEFAULT_WINDOW_WIDTH);
    expect(height).toBeGreaterThan(500);
    expect(height).toBeLessThanOrEqual(905 - 24);
  });
});

describe("openWindow", () => {
  it("places the first window inside the viewport", () => {
    const deck = openWindow(emptyDeck(), lead(1), viewport);
    const w = deck.windows[0];

    expect(w.key).toBe(windowKey("e1", "whatsapp"));
    expect(w.width).toBe(defaultWindowSize(viewport).width);
    expect(w.height).toBe(defaultWindowSize(viewport).height);
    expect(w.x).toBeGreaterThanOrEqual(0);
    expect(w.y).toBeGreaterThanOrEqual(0);
    expect(w.x + w.width).toBeLessThanOrEqual(viewport.width);
    expect(w.y + w.height).toBeLessThanOrEqual(viewport.height);
  });

  it("lays the second window out beside the first rather than on top of it", () => {
    let deck = openWindow(emptyDeck(), lead(1), viewport);
    deck = openWindow(deck, lead(2), viewport);

    const [first, second] = deck.windows;
    expect(second.x).not.toBe(first.x);
    // Side by side, not cascaded over each other: the whole point is reading
    // two conversations at the same time.
    expect(Math.abs(second.x - first.x)).toBeGreaterThanOrEqual(
      defaultWindowSize(viewport).width,
    );
  });

  it("reopening an entry focuses and restores it instead of duplicating it", () => {
    let deck = openWindow(emptyDeck(), lead(1), viewport);
    deck = openWindow(deck, lead(2), viewport);
    deck = setMinimized(deck, windowKey("e1", "whatsapp"), true);

    deck = openWindow(deck, lead(1), viewport);

    expect(deck.windows).toHaveLength(2);
    const reopened = deck.windows.find(
      (w) => w.key === windowKey("e1", "whatsapp"),
    )!;
    expect(reopened.minimized).toBe(false);
    expect(reopened.z).toBe(Math.max(...deck.windows.map((w) => w.z)));
  });

  // The cap is enforced where the open conversations live (the socket hook),
  // not here: two enforcement points would fight, the deck retiring a box for
  // a conversation still open and rebuilding it on the next render. This layer
  // lays out whatever it is given.
  it("gives every window of a full deck its own place on screen", () => {
    let deck = emptyDeck();
    for (let i = 1; i <= MAX_OPEN_WINDOWS; i++) {
      deck = openWindow(deck, lead(i), viewport);
    }

    expect(deck.windows).toHaveLength(MAX_OPEN_WINDOWS);
    expect(isWindowOpen(deck, windowKey("e1", "whatsapp"))).toBe(true);

    // No two windows may sit at the same spot: one exactly covering another
    // reads as a window that lost its neighbour.
    const spots = deck.windows.map((w) => `${w.x},${w.y}`);
    expect(new Set(spots).size).toBe(MAX_OPEN_WINDOWS);

    for (const w of deck.windows) {
      expect(w.x).toBeGreaterThanOrEqual(0);
      expect(w.y).toBeGreaterThanOrEqual(0);
      expect(w.x + w.width).toBeLessThanOrEqual(viewport.width);
      expect(w.y + w.height).toBeLessThanOrEqual(viewport.height);
    }
  });

  it("reuses the slot a closed window freed", () => {
    let deck = openWindow(emptyDeck(), lead(1), viewport);
    deck = openWindow(deck, lead(2), viewport);
    const secondX = deck.windows[1].x;

    deck = closeWindow(deck, windowKey("e2", "whatsapp"));
    deck = openWindow(deck, lead(3), viewport);

    expect(deck.windows[1].x).toBe(secondX);
  });

  it("keeps a narrow viewport's window on screen", () => {
    const deck = openWindow(emptyDeck(), lead(1), { width: 320, height: 480 });
    const w = deck.windows[0];

    expect(w.x).toBeGreaterThanOrEqual(0);
    expect(w.width).toBeLessThanOrEqual(320);
    expect(w.height).toBeLessThanOrEqual(480);
  });
});

describe("focus and z-order", () => {
  it("raises the focused window above the others", () => {
    let deck = openWindow(emptyDeck(), lead(1), viewport);
    deck = openWindow(deck, lead(2), viewport);

    deck = focusWindow(deck, windowKey("e1", "whatsapp"));

    const first = deck.windows.find((w) => w.key === windowKey("e1", "whatsapp"))!;
    const second = deck.windows.find((w) => w.key === windowKey("e2", "whatsapp"))!;
    expect(first.z).toBeGreaterThan(second.z);
  });

  it("focusing an already-topmost window changes nothing", () => {
    let deck = openWindow(emptyDeck(), lead(1), viewport);
    deck = openWindow(deck, lead(2), viewport);
    const before = deck;

    deck = focusWindow(deck, windowKey("e2", "whatsapp"));

    expect(deck).toBe(before);
  });

  it("ignores focus for a window that is not open", () => {
    const deck = openWindow(emptyDeck(), lead(1), viewport);
    expect(focusWindow(deck, "nope")).toBe(deck);
  });
});

describe("the minimized dock", () => {
  it("is nothing at all until something is minimized", () => {
    let deck = openWindow(emptyDeck(), lead(1), viewport);
    deck = openWindow(deck, lead(2), viewport);

    expect(dockHeight(deck)).toBe(0);
    expect(dockedBoxes(deck, viewport).size).toBe(0);
  });

  it("parks a minimized conversation on the bottom edge", () => {
    let deck = openWindow(emptyDeck(), lead(1), viewport);
    deck = setMinimized(deck, windowKey("e1", "whatsapp"), true);

    const box = dockedBoxes(deck, viewport).get(windowKey("e1", "whatsapp"))!;
    expect(box.height).toBe(MINIMIZED_WINDOW_HEIGHT);
    // Flush to the bottom, so it reads as parked rather than floating.
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    expect(viewport.height - (box.y + box.height)).toBeLessThanOrEqual(16);
  });

  /**
   * The bar carries a ChannelAvatar: a 32px circle with the channel badge hung
   * 8px below it. Centred in the bar, that badge needs 32 + 8*2 of height or it
   * gets sliced off by the bar's own overflow — which reads as a rendering
   * fault, not as a design.
   */
  it("is tall enough that the channel badge is not sliced off", () => {
    const AVATAR = 32;
    const BADGE_OVERHANG = 8;
    expect(MINIMIZED_WINDOW_HEIGHT).toBeGreaterThanOrEqual(
      AVATAR + BADGE_OVERHANG * 2,
    );
  });

  it("keeps a parked conversation narrow", () => {
    let deck = openWindow(emptyDeck(), lead(1), viewport);
    deck = setMinimized(deck, windowKey("e1", "whatsapp"), true);

    const box = dockedBoxes(deck, viewport).get(windowKey("e1", "whatsapp"))!;
    expect(box.width).toBe(MINIMIZED_WINDOW_WIDTH);
    expect(box.width).toBeLessThan(defaultWindowSize(viewport).width);
  });

  it("lines several parked conversations up side by side", () => {
    let deck = emptyDeck();
    for (let i = 1; i <= 3; i++) deck = openWindow(deck, lead(i), viewport);
    for (let i = 1; i <= 3; i++)
      deck = setMinimized(deck, windowKey(`e${i}`, "whatsapp"), true);

    const boxes = [...dockedBoxes(deck, viewport).values()];
    expect(boxes).toHaveLength(3);
    // All on one line, none on top of another.
    expect(new Set(boxes.map((b) => b.y)).size).toBe(1);
    expect(new Set(boxes.map((b) => b.x)).size).toBe(3);
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(viewport.width);
    }
  });

  it("reports the room the page must leave so the dock covers nothing", () => {
    let deck = openWindow(emptyDeck(), lead(1), viewport);
    deck = setMinimized(deck, windowKey("e1", "whatsapp"), true);

    // Enough for the bar itself plus the gap it sits in.
    expect(dockHeight(deck)).toBeGreaterThanOrEqual(MINIMIZED_WINDOW_HEIGHT);
  });

  // The bug this pins: a restored window reached the bottom edge and sat on
  // top of the dock it had just been pulled out of.
  it("leaves the open windows clear of the parked strip", () => {
    let deck = openWindow(emptyDeck(), lead(1), viewport);
    deck = openWindow(deck, lead(2), viewport);
    deck = setMinimized(deck, windowKey("e1", "whatsapp"), true);

    const room = dockHeight(deck);
    expect(room).toBeGreaterThan(0);

    // What the deck lays its windows out in once the dock has its strip.
    const area = { width: viewport.width, height: viewport.height - room };
    deck = clampDeckToViewport(deck, area);

    const open = deck.windows.find((w) => !w.minimized)!;
    expect(open.y + open.height).toBeLessThanOrEqual(viewport.height - room);
  });

  it("goes back to nothing once the last one is restored", () => {
    let deck = openWindow(emptyDeck(), lead(1), viewport);
    const key = windowKey("e1", "whatsapp");
    deck = setMinimized(deck, key, true);
    deck = setMinimized(deck, key, false);

    expect(dockHeight(deck)).toBe(0);
  });

  // Parking a window must not cost it the box it goes back to.
  it("restores a parked conversation to exactly where it was", () => {
    let deck = openWindow(emptyDeck(), lead(1), viewport);
    const key = windowKey("e1", "whatsapp");
    const before = deck.windows[0];

    deck = setMinimized(deck, key, true);
    deck = setMinimized(deck, key, false);

    const after = deck.windows[0];
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
    expect(after.width).toBe(before.width);
    expect(after.height).toBe(before.height);
  });
});

describe("minimize and maximize", () => {
  it("restoring a maximized window returns it to its previous box", () => {
    let deck = openWindow(emptyDeck(), lead(1), viewport);
    const key = windowKey("e1", "whatsapp");
    const original = deck.windows[0];

    deck = toggleMaximized(deck, key, viewport);
    const maximized = deck.windows[0];
    expect(maximized.maximized).toBe(true);
    expect(maximized.width).toBeGreaterThan(original.width);

    deck = toggleMaximized(deck, key, viewport);
    const restored = deck.windows[0];
    expect(restored.maximized).toBe(false);
    expect(restored.width).toBe(original.width);
    expect(restored.height).toBe(original.height);
    expect(restored.x).toBe(original.x);
    expect(restored.y).toBe(original.y);
  });

  it("un-minimizing also raises the window", () => {
    let deck = openWindow(emptyDeck(), lead(1), viewport);
    deck = openWindow(deck, lead(2), viewport);
    const key = windowKey("e1", "whatsapp");

    deck = setMinimized(deck, key, true);
    deck = setMinimized(deck, key, false);

    const first = deck.windows.find((w) => w.key === key)!;
    expect(first.z).toBe(Math.max(...deck.windows.map((w) => w.z)));
  });
});

describe("move and resize", () => {
  it("clamps a drag so the window cannot be pushed off screen", () => {
    const deck = moveWindow(
      openWindow(emptyDeck(), lead(1), viewport),
      windowKey("e1", "whatsapp"),
      { x: 5000, y: -400 },
      viewport,
    );
    const w = deck.windows[0];

    expect(w.x).toBeLessThanOrEqual(viewport.width - w.width);
    expect(w.y).toBe(0);
  });

  it("refuses to resize below the minimum readable box", () => {
    const deck = resizeWindow(
      openWindow(emptyDeck(), lead(1), viewport),
      windowKey("e1", "whatsapp"),
      { width: 10, height: 10 },
      viewport,
    );
    const w = deck.windows[0];

    expect(w.width).toBe(MIN_WINDOW_WIDTH);
    expect(w.height).toBe(MIN_WINDOW_HEIGHT);
  });
});

describe("clampDeckToViewport", () => {
  it("pulls windows back in when the browser shrinks", () => {
    let deck = openWindow(emptyDeck(), lead(1), viewport);
    deck = clampDeckToViewport(deck, { width: 600, height: 500 });
    const w = deck.windows[0];

    expect(w.x + w.width).toBeLessThanOrEqual(600);
    expect(w.y + w.height).toBeLessThanOrEqual(500);
  });

  it("is a no-op when everything already fits", () => {
    const deck = openWindow(emptyDeck(), lead(1), viewport);
    expect(clampDeckToViewport(deck, viewport)).toBe(deck);
  });
});
