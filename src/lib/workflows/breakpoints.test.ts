import { describe, expect, it } from "vitest";

import { liveBreakpoints, toggleBreakpoint } from "./breakpoints";

describe("toggleBreakpoint", () => {
  it("adds a node that had no breakpoint and removes one that had", () => {
    const one = toggleBreakpoint(new Set(), "n1");
    expect([...one]).toEqual(["n1"]);
    expect([...toggleBreakpoint(one, "n1")]).toEqual([]);
  });

  it("never mutates the set it was given, so React sees a new value", () => {
    const before = new Set(["n1"]);
    const after = toggleBreakpoint(before, "n2");
    expect(after).not.toBe(before);
    expect([...before]).toEqual(["n1"]);
  });
});

describe("liveBreakpoints", () => {
  it("drops breakpoints on deleted nodes and sorts the rest, so the session gets a stable list", () => {
    expect(liveBreakpoints(new Set(["n3", "gone", "n1"]), new Set(["n1", "n2", "n3"]))).toEqual(["n1", "n3"]);
  });

  it("is empty when nothing is set", () => {
    expect(liveBreakpoints(new Set(), new Set(["n1"]))).toEqual([]);
  });
});
