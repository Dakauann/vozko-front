import { describe, expect, it } from "vitest";

import { canRedo, canUndo, COALESCE_WINDOW_MS, HISTORY_LIMIT, historyReducer, initHistory, type History } from "./history";

function commit(state: History<string>, value: string, at: number, group?: string): History<string> {
  return historyReducer(state, { type: "commit", value, at, group });
}

describe("historyReducer", () => {
  it("undoes and redoes commits", () => {
    let state = initHistory("a");
    state = commit(state, "b", 1000);
    state = commit(state, "c", 5000);
    expect(canUndo(state)).toBe(true);
    state = historyReducer(state, { type: "undo" });
    expect(state.present).toBe("b");
    state = historyReducer(state, { type: "undo" });
    expect(state.present).toBe("a");
    expect(canUndo(state)).toBe(false);
    state = historyReducer(state, { type: "redo" });
    expect(state.present).toBe("b");
    expect(canRedo(state)).toBe(true);
  });

  it("coalesces rapid typing in the same field", () => {
    let state = initHistory("");
    state = commit(state, "o", 1000, "heading:a");
    state = commit(state, "ol", 1200, "heading:a");
    state = commit(state, "olá", 1200 + COALESCE_WINDOW_MS, "heading:a");
    expect(state.past).toEqual([""]);
    expect(state.present).toBe("olá");
  });

  it("starts a new step after a pause or in another field", () => {
    let state = initHistory("");
    state = commit(state, "o", 1000, "heading:a");
    state = commit(state, "ol", 1000 + COALESCE_WINDOW_MS + 1, "heading:a");
    state = commit(state, "ol!", 1700, "button:b");
    expect(state.past).toEqual(["", "o", "ol"]);
  });

  it("never coalesces commits without a group", () => {
    let state = initHistory("a");
    state = commit(state, "b", 1000);
    state = commit(state, "c", 1001);
    expect(state.past).toEqual(["a", "b"]);
  });

  it("drops the redo stack on a new commit", () => {
    let state = commit(commit(initHistory("a"), "b", 1000), "c", 3000);
    state = historyReducer(state, { type: "undo" });
    state = commit(state, "d", 6000);
    expect(state.future).toEqual([]);
    expect(canRedo(state)).toBe(false);
  });

  it("keeps at most the bounded number of steps", () => {
    let state = initHistory("0");
    for (let index = 1; index <= HISTORY_LIMIT + 20; index += 1) state = commit(state, String(index), index * 1000);
    expect(state.past).toHaveLength(HISTORY_LIMIT);
    expect(state.past[0]).toBe("20");
  });

  it("adopts an outside value without adding a step", () => {
    let state = commit(initHistory("a"), "b", 1000, "x");
    state = historyReducer(state, { type: "adopt", value: "z" });
    expect(state.present).toBe("z");
    expect(state.past).toEqual(["a"]);
    state = commit(state, "zz", 1100, "x");
    expect(state.past).toEqual(["a", "z"]);
  });

  it("ignores commits of the same value", () => {
    const state = initHistory("a");
    expect(commit(state, "a", 1000)).toBe(state);
  });
});

describe("joined batches", () => {
  it("keeps one undo step for a batch that spans pauses while nobody else edits", () => {
    let state = initHistory("a");
    state = historyReducer(state, { type: "commit", value: "b", at: 1000, group: "agent-1", join: true });
    state = historyReducer(state, { type: "commit", value: "c", at: 1000 + 10 * COALESCE_WINDOW_MS, group: "agent-1", join: true });
    expect(state.past).toEqual(["a"]);
    expect(historyReducer(state, { type: "undo" }).present).toBe("a");
  });

  it("starts a new step once the person edited in between", () => {
    let state = initHistory("a");
    state = historyReducer(state, { type: "commit", value: "b", at: 1000, group: "agent-1", join: true });
    state = commit(state, "b!", 1100, "heading:x");
    state = historyReducer(state, { type: "commit", value: "c", at: 1200, group: "agent-1", join: true });
    expect(state.past).toEqual(["a", "b", "b!"]);
  });
});
