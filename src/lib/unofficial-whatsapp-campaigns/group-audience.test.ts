import { describe, expect, it } from "vitest";

import type { GroupRow, NumberSeat } from "@/lib/unofficial-whatsapp-groups/types";

import { groupTargets, numberCanPost, readGroupPrefill, splitByPosting } from "./group-audience";

function seat(instanceId: string, canPost: boolean): NumberSeat {
  return { instanceId, label: instanceId, connected: true, admin: false, canPost };
}

function row(id: string, seats: NumberSeat[]): GroupRow {
  return {
    group: { id, jid: `${id}@g.us`, subject: `Grupo ${id}` },
    numbers: seats,
  } as GroupRow;
}

describe("readGroupPrefill", () => {
  it("reads the number and the group ids a groups link carries", () => {
    expect(readGroupPrefill({ audience: "groups", instanceId: "i-1", groups: "g-1, g-2,,g-1" })).toEqual({
      instanceId: "i-1",
      groupIds: ["g-1", "g-2"],
    });
  });

  it("ignores a link that does not ask for groups", () => {
    expect(readGroupPrefill({ instanceId: "i-1", groups: "g-1" })).toBeNull();
    expect(readGroupPrefill({ audience: "leads", instanceId: "i-1" })).toBeNull();
  });

  it("keeps the groups audience without a number or groups", () => {
    expect(readGroupPrefill({ audience: "groups" })).toEqual({ instanceId: "", groupIds: [] });
  });

  it("takes the first value of a repeated parameter", () => {
    expect(readGroupPrefill({ audience: ["groups", "leads"], instanceId: ["i-2"], groups: ["g-3", "g-4"] })).toEqual({
      instanceId: "i-2",
      groupIds: ["g-3"],
    });
  });
});

describe("numberCanPost", () => {
  it("is true only when the chosen number sits in the group and may post", () => {
    expect(numberCanPost([seat("i-1", true)], "i-1")).toBe(true);
    expect(numberCanPost([seat("i-1", false)], "i-1")).toBe(false);
    expect(numberCanPost([seat("i-2", true)], "i-1")).toBe(false);
  });
});

describe("splitByPosting", () => {
  it("keeps the groups the number can post in and counts the read-only ones", () => {
    const rows = [row("a", [seat("i-1", true)]), row("b", [seat("i-1", false)]), row("c", [seat("i-1", true), seat("i-2", false)])];
    const split = splitByPosting(rows, "i-1");
    expect(split.postable.map((r) => r.group.id)).toEqual(["a", "c"]);
    expect(split.readOnly).toBe(1);
  });
});

describe("groupTargets", () => {
  it("sends each picked group by its jid and subject, without a number", () => {
    expect(groupTargets([{ id: "g-1", jid: "1@g.us", subject: "Vendas" }])).toEqual([{ groupJid: "1@g.us", name: "Vendas" }]);
  });
});
