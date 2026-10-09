import { describe, expect, it } from "vitest";

import { emptyCrmFilter, type CrmFilter } from "../board";
import { bulkRequest, bulkSelectionSize, filterSelection } from "../bulk-selection";

const unread: CrmFilter = {
  groups: [{ conjunction: "and", predicates: [{ field: "unread", operator: "is_true", values: [] }] }],
};

describe("bulkRequest", () => {
  it("sends explicit picks as ids", () => {
    const request = bulkRequest("move_stage", "stage-b", {
      kind: "ids",
      targets: [{ entryId: "e1", entryType: "whatsapp" }],
    });
    expect(request).toEqual({
      action: "move_stage",
      value: "stage-b",
      mode: "ids",
      targets: [{ entryId: "e1", entryType: "whatsapp" }],
    });
  });

  it("sends a filtered selection as all matching with the confirmed count", () => {
    const request = bulkRequest("add_label", "l1", filterSelection(unread, { matched: 340, fingerprint: "fp" }));
    expect(request).toEqual({
      action: "add_label",
      value: "l1",
      mode: "all_matching",
      filter: unread,
      expectedCount: 340,
      fingerprint: "fp",
    });
  });

  it("sends an unfiltered selection as everyone, without a filter", () => {
    const request = bulkRequest("assign", "u1", filterSelection(emptyCrmFilter, { matched: 12, fingerprint: "fp0" }));
    expect(request).toEqual({
      action: "assign",
      value: "u1",
      mode: "everyone",
      expectedCount: 12,
      fingerprint: "fp0",
    });
  });
});

describe("bulkSelectionSize", () => {
  it("counts picks by their targets and filters by the server count", () => {
    expect(bulkSelectionSize({ kind: "ids", targets: [{ entryId: "e1", entryType: "whatsapp" }] })).toBe(1);
    expect(bulkSelectionSize(filterSelection(unread, { matched: 340, fingerprint: "fp" }))).toBe(340);
  });
});

describe("filterSelection", () => {
  it("marks a selection without predicates as everyone", () => {
    expect(filterSelection(emptyCrmFilter, { matched: 1, fingerprint: "a" }).mode).toBe("everyone");
    expect(filterSelection(unread, { matched: 1, fingerprint: "a" }).mode).toBe("all_matching");
  });
});
