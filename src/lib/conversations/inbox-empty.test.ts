import { describe, expect, it } from "vitest";

import { inboxEmptyState, type InboxEmptyInput } from "./inbox-empty";

const nothingNarrowed: InboxEmptyInput = { query: "", filterCount: 0, status: "all", blockedByDepartment: false };

describe("why the inbox is empty, and what clears it", () => {
  it("blames the search first and offers to clear it", () => {
    expect(inboxEmptyState({ ...nothingNarrowed, query: "maria", filterCount: 2, status: "new" })).toEqual({ kind: "search", action: "clearSearch" });
  });

  it("blames the advanced filters when there is no search text", () => {
    expect(inboxEmptyState({ ...nothingNarrowed, filterCount: 1, status: "finished" })).toEqual({ kind: "filters", action: "clearFilters" });
  });

  it("explains a missing department before an empty tab, as no tab can show anything then", () => {
    expect(inboxEmptyState({ ...nothingNarrowed, status: "new", blockedByDepartment: true })).toEqual({ kind: "department", action: null });
  });

  it.each(["new", "ongoing", "finished"] as const)("names the empty %s tab and offers the active ones", (status) => {
    expect(inboxEmptyState({ ...nothingNarrowed, status })).toEqual({ kind: status, action: "showActive" });
  });

  it("has nothing to clear when the whole inbox is empty", () => {
    expect(inboxEmptyState(nothingNarrowed)).toEqual({ kind: "none", action: null });
  });

  it("ignores blank search text", () => {
    expect(inboxEmptyState({ ...nothingNarrowed, query: "   " })).toEqual({ kind: "none", action: null });
  });
});
