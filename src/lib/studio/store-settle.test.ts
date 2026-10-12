import { describe, expect, it } from "vitest";

import { createStudioStore } from "./store";

interface Doc {
  items: number[];
  total: number;
}

const settle = (before: Doc, after: Doc): Doc => {
  const total = after.items.reduce((sum, value) => sum + value, 0);
  return total === after.total ? after : { ...after, total };
};

describe("settling the store", () => {
  it("runs on apply, update and applyAs and undoes in one step", () => {
    const store = createStudioStore<Doc>({ items: [1], total: 1 }, { settle });
    store.getState().apply((doc) => ({ ...doc, items: [...doc.items, 2] }));
    expect(store.getState().document).toEqual({ items: [1, 2], total: 3 });
    store.getState().update((draft) => {
      draft.items.push(4);
    });
    expect(store.getState().document).toEqual({ items: [1, 2, 4], total: 7 });
    store.getState().applyAs("elo", (doc) => ({ ...doc, items: [10] }));
    expect(store.getState().document).toEqual({ items: [10], total: 10 });
    store.getState().undo();
    expect(store.getState().document).toEqual({ items: [1, 2, 4], total: 7 });
    store.getState().undo();
    expect(store.getState().document).toEqual({ items: [1, 2], total: 3 });
  });

  it("drops an edit that settles back to the current document", () => {
    const store = createStudioStore<Doc>({ items: [1], total: 1 }, { settle: (before) => before });
    store.getState().apply((doc) => ({ ...doc, items: [5] }));
    expect(store.getState().document).toEqual({ items: [1], total: 1 });
    expect(store.getState().canUndo).toBe(false);
  });
});
