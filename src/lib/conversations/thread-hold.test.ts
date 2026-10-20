import { describe, expect, it } from "vitest";

import { holdThread, noThreadHold, type ThreadHold } from "./thread-hold";

interface Thread {
  name: string;
  messages: string[];
}

const first: Thread = { name: "first", messages: ["a", "b"] };
const secondEmpty: Thread = { name: "second", messages: [] };
const secondLoaded: Thread = { name: "second", messages: ["x"] };

interface Step {
  key: string | null;
  thread: Thread | null;
  loading: boolean;
}

function after(steps: Step[]): ThreadHold<Thread> {
  return steps.reduce<ThreadHold<Thread>>((hold, step) => holdThread(hold, step.key, step.thread, step.loading), noThreadHold());
}

describe("thread hold", () => {
  it("shows the first thread as soon as it opens", () => {
    const hold = after([{ key: "w:1", thread: first, loading: false }]);
    expect(hold.shown).toBe(first);
    expect(hold.waiting).toBe(false);
  });

  it("keeps the previous thread on screen while the next one has no page yet", () => {
    const hold = after([
      { key: "w:1", thread: first, loading: false },
      { key: "w:2", thread: secondEmpty, loading: true },
    ]);
    expect(hold.shown).toBe(first);
    expect(hold.key).toBe("w:1");
    expect(hold.waiting).toBe(true);
  });

  it("swaps to the next thread the moment its first page arrives", () => {
    const hold = after([
      { key: "w:1", thread: first, loading: false },
      { key: "w:2", thread: secondEmpty, loading: true },
      { key: "w:2", thread: secondLoaded, loading: false },
    ]);
    expect(hold.shown).toBe(secondLoaded);
    expect(hold.key).toBe("w:2");
    expect(hold.waiting).toBe(false);
  });

  it("swaps to a conversation that really is empty once loading ends", () => {
    const hold = after([
      { key: "w:1", thread: first, loading: false },
      { key: "w:2", thread: secondEmpty, loading: true },
      { key: "w:2", thread: secondEmpty, loading: false },
    ]);
    expect(hold.shown).toBe(secondEmpty);
    expect(hold.waiting).toBe(false);
  });

  it("has nothing to hold on the very first open, so it shows the empty thread", () => {
    const hold = after([{ key: "w:2", thread: secondEmpty, loading: true }]);
    expect(hold.shown).toBe(secondEmpty);
    expect(hold.waiting).toBe(false);
  });

  it("follows live updates of the shown thread", () => {
    const updated = { ...first, messages: [...first.messages, "c"] };
    const hold = after([
      { key: "w:1", thread: first, loading: false },
      { key: "w:1", thread: updated, loading: false },
    ]);
    expect(hold.shown).toBe(updated);
  });

  it("clears when the conversation is closed", () => {
    const hold = after([
      { key: "w:1", thread: first, loading: false },
      { key: null, thread: null, loading: false },
    ]);
    expect(hold.shown).toBeNull();
  });

  it("returns the same hold when nothing changed so render-time updates settle", () => {
    const shown = after([{ key: "w:1", thread: first, loading: false }]);
    expect(holdThread(shown, "w:1", first, false)).toBe(shown);
    const waiting = holdThread(shown, "w:2", secondEmpty, true);
    expect(holdThread(waiting, "w:2", secondEmpty, true)).toBe(waiting);
  });
});
