import { describe, expect, it } from "vitest";

import type { GroupRow, NumberSeat } from "@/lib/unofficial-whatsapp-groups/types";

import { blocksForGood, groupPosting, groupTargets, readGroupPrefill } from "./group-audience";

function seat(instanceId: string, patch: Partial<NumberSeat> = {}): NumberSeat {
  return { instanceId, label: instanceId, connected: true, admin: false, canPost: true, ...patch };
}

function row(seats: NumberSeat[], announce = false): Pick<GroupRow, "group" | "numbers"> {
  return { group: { id: "g", jid: "g@g.us", subject: "Grupo", announce } as GroupRow["group"], numbers: seats };
}

describe("readGroupPrefill", () => {
  it("reads the group ids a groups link carries and no number", () => {
    expect(readGroupPrefill({ audience: "groups", instanceId: "i-1", groups: "g-1, g-2,,g-1" })).toEqual({ groupIds: ["g-1", "g-2"] });
  });

  it("ignores a link that does not ask for groups", () => {
    expect(readGroupPrefill({ groups: "g-1" })).toBeNull();
    expect(readGroupPrefill({ audience: "leads" })).toBeNull();
  });

  it("keeps the groups audience without groups", () => {
    expect(readGroupPrefill({ audience: "groups" })).toEqual({ groupIds: [] });
  });

  it("takes the first value of a repeated parameter", () => {
    expect(readGroupPrefill({ audience: ["groups", "leads"], groups: ["g-3", "g-4"] })).toEqual({ groupIds: ["g-3"] });
  });
});

describe("groupPosting", () => {
  it("lists every number that may post now", () => {
    const posting = groupPosting(row([seat("a"), seat("b"), seat("c", { canPost: false, connected: false })]));
    expect(posting.senders.map((s) => s.instanceId)).toEqual(["a", "b"]);
    expect(posting.block).toBeUndefined();
  });

  it("says no number of yours is in the group", () => {
    expect(groupPosting(row([])).block).toBe("not_in_group");
  });

  it("says only admins post when no number there is an admin", () => {
    expect(groupPosting(row([seat("a", { canPost: false })], true)).block).toBe("cannot_post");
  });

  it("waits for an offline number that could post", () => {
    expect(groupPosting(row([seat("a", { canPost: false }), seat("b", { canPost: false, connected: false, admin: true })], true)).block).toBe("offline");
    expect(groupPosting(row([seat("a", { canPost: false, connected: false })])).block).toBe("offline");
  });
});

describe("blocksForGood", () => {
  it("keeps offline groups and drops the ones no number can ever post in", () => {
    expect(blocksForGood("not_in_group")).toBe(true);
    expect(blocksForGood("cannot_post")).toBe(true);
    expect(blocksForGood("offline")).toBe(false);
    expect(blocksForGood(undefined)).toBe(false);
  });
});

describe("groupTargets", () => {
  it("sends each picked group by its jid and subject, without a number", () => {
    expect(groupTargets([{ id: "g-1", jid: "1@g.us", subject: "Vendas" }])).toEqual([{ groupJid: "1@g.us", name: "Vendas" }]);
  });
});
