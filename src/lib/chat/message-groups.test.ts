import { describe, expect, it } from "vitest";

import { GROUP_GAP_MS, groupPositions, joinsGroup, type GroupMember } from "./message-groups";

const START = Date.parse("2026-10-20T12:00:00Z");

function member(author: string, minutes: number): GroupMember {
  return { author, at: new Date(START + minutes * 60_000).toISOString() };
}

describe("joinsGroup", () => {
  it("joins the same author within the gap, the way a chat stacks one person's burst", () => {
    expect(joinsGroup(member("bia", 0), member("bia", 4))).toBe(true);
    expect(joinsGroup(member("bia", 0), { author: "bia", at: new Date(START + GROUP_GAP_MS).toISOString() })).toBe(true);
  });

  it("starts a new group for another author, a pause longer than the gap, or nothing before", () => {
    expect(joinsGroup(member("bia", 0), member("caio", 1))).toBe(false);
    expect(joinsGroup(member("bia", 0), member("bia", 6))).toBe(false);
    expect(joinsGroup(null, member("bia", 0))).toBe(false);
  });

  it("never joins across a time it cannot read or a clock that runs backwards", () => {
    expect(joinsGroup(member("bia", 0), { author: "bia", at: "" })).toBe(false);
    expect(joinsGroup(member("bia", 2), member("bia", 1))).toBe(false);
  });
});

describe("groupPositions", () => {
  it("marks the first, middle and last of a run and leaves a lone message single", () => {
    expect(groupPositions([member("bia", 0), member("bia", 1), member("bia", 2), member("caio", 3)])).toEqual(["first", "middle", "last", "single"]);
  });

  it("lets a row that is not a message break the run on both sides", () => {
    expect(groupPositions([member("bia", 0), null, member("bia", 1), member("bia", 2)])).toEqual(["single", null, "first", "last"]);
  });
});
