import { describe, expect, it } from "vitest";

import {
  cleared,
  countFailed,
  countingStarted,
  initialBulkSelection,
  offersAllMatching,
  pageHeaderState,
  rescoped,
  selectionSize,
  togglePage,
  togglePicked,
  widened,
  withPicked,
} from "./bulk-state";

const PAGE_ONE = ["a", "b", "c"];
const PAGE_TWO = ["d", "e", "f"];

describe("page header state", () => {
  it("is checked only when every key of the current page is picked", () => {
    expect(pageHeaderState(PAGE_ONE, new Set(["a", "b", "c", "x"]))).toBe("all");
  });

  it("is mixed when some keys of the current page are picked", () => {
    expect(pageHeaderState(PAGE_ONE, new Set(["a"]))).toBe("some");
  });

  it("ignores picks that live on other pages", () => {
    expect(pageHeaderState(PAGE_TWO, new Set(["a", "b", "c"]))).toBe("none");
  });

  it("is never checked on an empty page", () => {
    expect(pageHeaderState([], new Set(["a"]))).toBe("none");
  });
});

describe("toggling a page", () => {
  it("adds only the current page keys and keeps picks from other pages", () => {
    const next = togglePage(new Set(["a", "b", "c"]), PAGE_TWO);
    expect([...next].sort()).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("removes only the current page keys when the page is already picked", () => {
    const next = togglePage(new Set(["a", "b", "c", "d", "e", "f"]), PAGE_TWO);
    expect([...next].sort()).toEqual(["a", "b", "c"]);
  });

  it("completes a partly picked page instead of clearing it", () => {
    const next = togglePage(new Set(["a", "d"]), PAGE_TWO);
    expect([...next].sort()).toEqual(["a", "d", "e", "f"]);
  });

  it("toggles one key without touching the others", () => {
    expect([...togglePicked(new Set(["a", "d"]), "d")]).toEqual(["a"]);
    expect([...togglePicked(new Set(["a"]), "d")].sort()).toEqual(["a", "d"]);
  });
});

describe("selection kept across pages", () => {
  it("keeps picks from page one while page two is picked", () => {
    let state = initialBulkSelection("filter-1");
    state = withPicked(state, togglePage(state.picked, PAGE_ONE));
    state = withPicked(state, togglePage(state.picked, PAGE_TWO));
    expect(selectionSize(state)).toBe(6);
    expect(pageHeaderState(PAGE_ONE, state.picked)).toBe("all");
  });

  it("starts over when the filter, search or sort changes", () => {
    let state = withPicked(initialBulkSelection("filter-1"), new Set(PAGE_ONE));
    state = widened(countingStarted(state, "all_matching"), { mode: "all_matching", scope: "filter-1", matched: 340 });
    const next = rescoped(state, "filter-2");
    expect(next.picked.size).toBe(0);
    expect(next.wide).toBeNull();
    expect(next.scope).toBe("filter-2");
  });

  it("stays the same object when the scope did not change", () => {
    const state = withPicked(initialBulkSelection("filter-1"), new Set(PAGE_ONE));
    expect(rescoped(state, "filter-1")).toBe(state);
  });
});

describe("widening the selection", () => {
  it("offers all matching once the whole page is picked and more rows exist", () => {
    expect(offersAllMatching(new Set(PAGE_ONE), PAGE_ONE, 340)).toBe(true);
    expect(offersAllMatching(new Set(["a", "b"]), PAGE_ONE, 340)).toBe(false);
    expect(offersAllMatching(new Set(PAGE_ONE), PAGE_ONE, 3)).toBe(false);
    expect(offersAllMatching(new Set(), [], 340)).toBe(false);
  });

  it("counts while widening and settles on the counted total", () => {
    let state = withPicked(initialBulkSelection("filter-1"), new Set(PAGE_ONE));
    state = countingStarted(state, "all_matching");
    expect(state.counting).toBe("all_matching");
    state = widened(state, { mode: "all_matching", scope: "filter-1", matched: 352, fingerprint: "fp-1" });
    expect(state.counting).toBeNull();
    expect(state.wide).toEqual({ mode: "all_matching", scope: "filter-1", matched: 352, fingerprint: "fp-1" });
    expect(selectionSize(state)).toBe(352);
  });

  it("ignores a count that answers for a filter that is no longer shown", () => {
    let state = countingStarted(withPicked(initialBulkSelection("filter-1"), new Set(PAGE_ONE)), "all_matching");
    state = rescoped(state, "filter-2");
    state = widened(state, { mode: "all_matching", scope: "filter-1", matched: 352 });
    expect(state.wide).toBeNull();
  });

  it("keeps the picks when the count fails", () => {
    let state = countingStarted(withPicked(initialBulkSelection("filter-1"), new Set(PAGE_ONE)), "all_matching");
    state = countFailed(state);
    expect(state.counting).toBeNull();
    expect(state.wide).toBeNull();
    expect(state.picked.size).toBe(3);
  });

  it("caps a quantity selection at its limit", () => {
    const state = widened(initialBulkSelection("filter-1"), { mode: "first_n", scope: "filter-1", matched: 9000, limit: 5000 });
    expect(selectionSize(state)).toBe(5000);
  });

  it("counts a quantity selection whose limit is above the matches as the matches", () => {
    const state = widened(initialBulkSelection("filter-1"), { mode: "first_n", scope: "filter-1", matched: 120, limit: 5000 });
    expect(selectionSize(state)).toBe(120);
  });

  it("drops the widened mode as soon as a row is hand-edited", () => {
    let state = widened(initialBulkSelection("filter-1"), { mode: "all_matching", scope: "filter-1", matched: 352 });
    state = withPicked(state, new Set(["a"]));
    expect(state.wide).toBeNull();
    expect(selectionSize(state)).toBe(1);
  });

  it("clears picks and the widened mode together", () => {
    let state = withPicked(initialBulkSelection("filter-1"), new Set(PAGE_ONE));
    state = cleared(widened(state, { mode: "everyone", scope: "filter-1", matched: 7942 }));
    expect(selectionSize(state)).toBe(0);
    expect(state.wide).toBeNull();
  });
});
