import { describe, expect, it } from "vitest";

import { READY, blocked, firstBlocker, reasonOf, type ActionState } from "./action-state";

describe("action state", () => {
  it("is ready when no check fails", () => {
    expect(firstBlocker<"permission" | "empty">([[false, "permission"], [false, "empty"]])).toEqual(READY);
  });

  it("names the first failing check, in the order given", () => {
    const state = firstBlocker<"permission" | "empty">([[false, "permission"], [true, "empty"], [true, "permission"]]);
    expect(state).toEqual({ enabled: false, reason: "empty" });
  });

  it("builds a blocked state with its reason", () => {
    const state: ActionState<"soon"> = blocked("soon");
    expect(state.enabled).toBe(false);
    expect(reasonOf(state)).toBe("soon");
  });

  it("has no reason when the action is ready", () => {
    expect(reasonOf(READY)).toBeNull();
  });
});
