import { describe, expect, it } from "vitest";

import { EDGE_TAB_WIDTH, createEdgeRailRegistry } from "./edge-rail";

describe("edge rail reserve", () => {
  it("reserves the rail while any tab is on it and frees it when the last one leaves", () => {
    const applied: string[] = [];
    const rail = createEdgeRailRegistry((width) => applied.push(width));

    rail.enter();
    rail.enter();
    rail.leave();
    expect(applied.at(-1)).toBe(EDGE_TAB_WIDTH);

    rail.leave();
    expect(applied.at(-1)).toBe("0px");
  });

  it("never counts below zero, so a stray leave cannot hide the next tab's reserve", () => {
    const applied: string[] = [];
    const rail = createEdgeRailRegistry((width) => applied.push(width));

    rail.leave();
    rail.enter();
    expect(applied.at(-1)).toBe(EDGE_TAB_WIDTH);
  });
});
