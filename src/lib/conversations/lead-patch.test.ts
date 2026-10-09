import { describe, expect, it } from "vitest";

import type { LeadRecord } from "@/lib/leads/types";

import {
  leadPatchFromRecord,
  leadPresence,
  mergeSubscribedLead,
  patchLead,
  patchLeadColumns,
  patchLeadList,
  planLeadUpdate,
  subscribedLeadPatch,
  vouchSubscribedLead,
  type LeadCarrier,
} from "./lead-patch";

function carrier(overrides: Partial<LeadCarrier> = {}): LeadCarrier {
  return { lead_id: "lead-1", lead_version: 3, lead_name: "Ana", lead_number: "5511999990000", ...overrides };
}

function record(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: "lead-1",
    workspaceId: "ws-1",
    number: "5511999990000",
    name: "Ana Paula",
    blocked: false,
    relativesCount: 0,
    referredCount: 0,
    version: 4,
    ...overrides,
  };
}

describe("patchLead", () => {
  it("patches a carrier of the same lead with a newer version", () => {
    const out = patchLead(carrier(), "lead-1", { lead_name: "Ana Paula", lead_version: 4 });
    expect(out).toMatchObject({ lead_name: "Ana Paula", lead_version: 4 });
  });

  it("keeps a carrier that already holds a newer version", () => {
    const original = carrier({ lead_version: 5 });
    expect(patchLead(original, "lead-1", { lead_name: "Old", lead_version: 4 })).toBe(original);
  });

  it("leaves other leads and carriers without a lead untouched", () => {
    const other = carrier({ lead_id: "lead-2" });
    const orphan = carrier({ lead_id: undefined });
    expect(patchLead(other, "lead-1", { lead_name: "X", lead_version: 9 })).toBe(other);
    expect(patchLead(orphan, "lead-1", { lead_name: "X", lead_version: 9 })).toBe(orphan);
    expect(patchLead(other, "", { lead_name: "X", lead_version: 9 })).toBe(other);
  });

  it("returns the same object when nothing changes, so nothing re-renders", () => {
    const original = carrier();
    expect(patchLead(original, "lead-1", { lead_name: "Ana", lead_version: 3 })).toBe(original);
  });
});

describe("patchLeadList and patchLeadColumns", () => {
  it("patch every carrier of the lead and keep the same list when none matches", () => {
    const list = [carrier(), carrier({ lead_id: "lead-2" }), carrier()];
    const out = patchLeadList(list, "lead-1", { blocked: true, lead_version: 4 });
    expect(out.map((c) => c.blocked)).toEqual([true, undefined, true]);
    expect(patchLeadList(list, "lead-9", { blocked: true, lead_version: 4 })).toBe(list);
  });

  it("patch only the carriers the filter keeps", () => {
    const list = [carrier({ lead_number: "a" }), carrier({ lead_number: "b" })];
    const out = patchLeadList(list, "lead-1", { lead_name: "Bia", lead_version: 4 }, (c) => c.lead_number === "b");
    expect(out.map((c) => c.lead_name)).toEqual(["Ana", "Bia"]);
    expect(out[0]).toBe(list[0]);
  });

  it("patch only the columns that hold the lead", () => {
    const columns = new Map([
      ["s1", { entries: [carrier()] }],
      ["s2", { entries: [carrier({ lead_id: "lead-2" })] }],
    ]);
    const out = patchLeadColumns(columns, "lead-1", { lead_name: "Bia", lead_version: 4 });
    expect(out.get("s1")?.entries[0].lead_name).toBe("Bia");
    expect(out.get("s2")).toBe(columns.get("s2"));
    expect(patchLeadColumns(columns, "lead-9", { lead_name: "Bia", lead_version: 4 })).toBe(columns);
  });
});

describe("leadPresence", () => {
  it("reports whether the lead is shown and the newest version held", () => {
    const presence = leadPresence([carrier({ lead_version: 2 }), null, carrier({ lead_version: 5 }), carrier({ lead_id: "lead-2", lead_version: 9 })], "lead-1");
    expect(presence).toEqual({ shown: true, version: 5 });
  });

  it("reports a lead that is not on screen", () => {
    expect(leadPresence([carrier({ lead_id: "lead-2" })], "lead-1")).toEqual({ shown: false });
  });

  it("reports a shown lead whose version is unknown", () => {
    expect(leadPresence([carrier({ lead_version: undefined })], "lead-1")).toEqual({ shown: true });
  });
});

describe("planLeadUpdate", () => {
  const event = (version: number, fields: string[]) => ({ leadId: "lead-1", version, fields });

  it.each([
    ["a lead not on screen", { shown: false }, event(4, ["name"]), "ignore"],
    ["a version already held", { shown: true, version: 4 }, event(4, ["name"]), "ignore"],
    ["an older version", { shown: true, version: 5 }, event(4, ["name"]), "ignore"],
    ["a version that is not a number", { shown: true, version: 3 }, event(Number.NaN, ["name"]), "ignore"],
    ["the next version touching nothing shown", { shown: true, version: 3 }, event(4, ["email", "owner"]), "advance"],
    ["the next version touching the name", { shown: true, version: 3 }, event(4, ["name"]), "refetch"],
    ["the next version touching the block", { shown: true, version: 3 }, event(4, ["blocked"]), "refetch"],
    ["a gap in versions", { shown: true, version: 3 }, event(5, ["email"]), "refetch"],
    ["an unknown held version", { shown: true }, event(4, ["email"]), "refetch"],
  ] as const)("answers %s", (_, presence, update, expected) => {
    expect(planLeadUpdate(presence, update)).toBe(expected);
  });
});

describe("leadPatchFromRecord", () => {
  it("takes only the fields the change names, plus the version", () => {
    expect(leadPatchFromRecord(record({ blocked: true }), ["blocked", "email"])).toEqual({
      blocked: true,
      lead_version: 4,
    });
    expect(leadPatchFromRecord(record(), ["owner"])).toEqual({ lead_version: 4 });
  });

  it("clears the name when the record has none", () => {
    expect(leadPatchFromRecord(record({ name: undefined }), ["name"]).lead_name).toBe("");
  });

  it("takes the number and the picture when the change names them", () => {
    const patch = leadPatchFromRecord(
      record({ number: "5511888880000", profilePictureUrl: "https://cdn/p.jpg" }),
      ["name", "number", "profilePictureUrl"],
    );
    expect(patch).toEqual({
      lead_name: "Ana Paula",
      lead_number: "5511888880000",
      lead_picture: "https://cdn/p.jpg",
      lead_version: 4,
    });
  });
});

describe("subscribedLeadPatch", () => {
  it("patches the name, and the number and picture the answer carries, at the answer version", () => {
    expect(
      subscribedLeadPatch({ lead_id: "lead-1", lead_version: 4, lead_name: "Bia", lead_number: "5511", lead_picture: "p.jpg" }),
    ).toEqual({ lead_version: 4, lead_name: "Bia", lead_number: "5511", lead_picture: "p.jpg" });
  });

  it("reads a missing name as a cleared name and keeps what the answer left out", () => {
    expect(subscribedLeadPatch({ lead_id: "lead-1", lead_version: 4 })).toEqual({ lead_version: 4, lead_name: "" });
  });

  it("patches the block state when the answer carries it", () => {
    expect(subscribedLeadPatch({ lead_id: "lead-1", lead_version: 4, lead_name: "Bia", blocked: false })).toEqual({
      lead_version: 4,
      lead_name: "Bia",
      blocked: false,
    });
  });

  it("refuses an answer without a lead or without a version", () => {
    expect(subscribedLeadPatch({ lead_version: 4, lead_name: "Bia" })).toBeNull();
    expect(subscribedLeadPatch({ lead_id: "lead-1", lead_name: "Bia" })).toBeNull();
  });
});

describe("vouchSubscribedLead", () => {
  const answer = { entry_id: "e1", lead_id: "lead-1", lead_version: 5, lead_name: "Bia", lead_number: "5511" };

  it("keeps the version when the answer carries every shown field the reread waits for", () => {
    expect(vouchSubscribedLead(answer, { leadId: "lead-1", fields: ["name", "number", "email"] })).toBe(answer);
  });

  it("drops the version when the reread waits for a field the answer cannot carry", () => {
    expect(vouchSubscribedLead(answer, { leadId: "lead-1", fields: ["name", "blocked"] })).toEqual({
      ...answer,
      lead_version: undefined,
    });
    expect(vouchSubscribedLead(answer, { leadId: "lead-1", fields: ["profilePictureUrl"] }).lead_version).toBeUndefined();
  });

  it("vouches for a block change only with the block state in the answer", () => {
    const withBlock = { ...answer, blocked: true };
    expect(vouchSubscribedLead(withBlock, { leadId: "lead-1", fields: ["name", "blocked"] })).toBe(withBlock);
  });

  it("keeps the version for an answer nobody waits for or about another lead", () => {
    expect(vouchSubscribedLead(answer, undefined)).toBe(answer);
    expect(vouchSubscribedLead(answer, { leadId: "lead-2", fields: ["blocked"] })).toBe(answer);
  });
});

describe("mergeSubscribedLead", () => {
  it("refuses an answer older than the version the carrier holds", () => {
    const held = carrier({ lead_version: 7, lead_name: "Ana Paula" });
    expect(mergeSubscribedLead(held, { lead_id: "lead-1", lead_version: 6, lead_name: "Ana" })).toBe(held);
  });

  it("applies a newer answer of the same lead, a cleared name included", () => {
    expect(mergeSubscribedLead(carrier(), { lead_id: "lead-1", lead_version: 4 })).toMatchObject({
      lead_name: "",
      lead_version: 4,
    });
  });

  it("keeps the lead fields when the answer could not vouch for its version", () => {
    const held = carrier();
    expect(mergeSubscribedLead(held, { lead_id: "lead-1", lead_name: "Bia" })).toBe(held);
  });

  it("takes the answer as is when the conversation now belongs to another lead", () => {
    expect(
      mergeSubscribedLead(carrier({ lead_version: 9 }), { lead_id: "lead-2", lead_version: 2, lead_name: "Bia" }),
    ).toMatchObject({ lead_id: "lead-2", lead_version: 2, lead_name: "Bia" });
  });

  it("keeps the shown names for a conversation without a lead", () => {
    const orphan = carrier({ lead_id: undefined, lead_version: undefined });
    expect(mergeSubscribedLead(orphan, { lead_name: "Grupo" })).toMatchObject({ lead_name: "Grupo", lead_number: "5511999990000" });
  });
});
