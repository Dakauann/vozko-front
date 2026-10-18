import { describe, expect, it } from "vitest";

import { clearedQuery, isNarrowed, isSearchedOrNarrowed, listParams, withoutFilter } from "./list-query";

describe("listParams", () => {
  it("passes every filter of the query to the list call", () => {
    expect(
      listParams(
        { action: "join", search: "vendas", followed: false, origin: "managed", category: "", instanceId: "i1", hasAnalysis: true, adminsOnly: true, sort: "name" },
        2,
        25,
      ),
    ).toEqual({ page: 2, pageSize: 25, search: "vendas", followed: false, origin: "managed", category: "", instanceId: "i1", hasAnalysis: true, adminsOnly: true, sort: "name" });
  });

  it("leaves out what the query does not narrow", () => {
    expect(listParams({}, 1, 50)).toEqual({ page: 1, pageSize: 50, sort: "recent" });
  });
});

describe("filter state", () => {
  it("counts a filter other than search as narrowing", () => {
    expect(isNarrowed({ search: "x", sort: "name", action: "join" })).toBe(false);
    expect(isNarrowed({ category: "" })).toBe(true);
    expect(isNarrowed({ followed: false })).toBe(true);
    expect(isNarrowed({ adminsOnly: true })).toBe(true);
  });

  it("counts search too when deciding between no matches and first use", () => {
    expect(isSearchedOrNarrowed({ search: "x" })).toBe(true);
    expect(isSearchedOrNarrowed({ sort: "members" })).toBe(false);
  });

  it("removes one filter and the pending action", () => {
    expect(withoutFilter({ action: "create", origin: "external", category: "", sort: "members" }, "category")).toEqual({ origin: "external", sort: "members" });
  });

  it("clears every filter and keeps the sort", () => {
    expect(clearedQuery({ action: "discover", search: "x", followed: true, origin: "managed", sort: "oldest" })).toEqual({ sort: "oldest" });
    expect(clearedQuery({ search: "x" })).toEqual({});
  });
});
