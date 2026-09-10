import { describe, expect, it } from "vitest";
import { allocateWaffle, entityColorIndex, share } from "./data";

describe("waffle proportions", () => {
  it("allocates exactly 100 cells even when rounded shares do not sum to 100", () => {
    expect(allocateWaffle([1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateWaffle([250, 1, 1, 1, 7]).reduce((sum, count) => sum + count, 0)).toBe(100);
  });
  it("never paints data for an empty population or invalid values", () => {
    expect(allocateWaffle([0, 0])).toEqual([0, 0]);
    expect(allocateWaffle([-3, NaN, Infinity, 2])).toEqual([0, 0, 0, 100]);
  });
  it("does not exaggerate sub-percent categories to force visible blocks", () => {
    expect(allocateWaffle([9999, 1])).toEqual([100, 0]);
  });
});

describe("chart scales", () => {
  it("keeps entity colours stable when order or filtering changes", () => {
    const ids = ["agent-a", "agent-b", "agent-c"];
    const colors = new Map(ids.map((id) => [id, entityColorIndex(id)]));
    for (const id of [...ids].reverse().slice(1)) expect(entityColorIndex(id)).toBe(colors.get(id));
  });
  it("guards empty and invalid denominators", () => {
    expect(share(3, 4)).toBe(75);
    expect(share(3, 0)).toBe(0);
    expect(share(NaN, 4)).toBe(0);
    expect(share(8, 4)).toBe(100);
  });
});
