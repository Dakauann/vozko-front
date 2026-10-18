import { describe, expect, it } from "vitest";

import {
  analysesListSearch,
  countParams,
  DEFAULT_ANALYSES_PAGE_SIZE,
  hasFilters,
  listParams,
  pageAfterRemoval,
  parseAnalysesListState,
  type AnalysesListState,
} from "./analyses-query";

const base: AnalysesListState = { search: "", sort: "recent", page: 1, pageSize: DEFAULT_ANALYSES_PAGE_SIZE };

describe("parseAnalysesListState", () => {
  it("reads every filter from the address", () => {
    const state = parseAnalysesListState(
      new URLSearchParams("status=paused&trigger=scheduled&groupId=g1&search=%20vendas%20&sort=name_desc&page=3&pageSize=100"),
    );
    expect(state).toEqual({ search: "vendas", status: "paused", trigger: "scheduled", groupId: "g1", sort: "name_desc", page: 3, pageSize: 100 });
  });

  it("falls back to the defaults on unknown or missing values", () => {
    expect(parseAnalysesListState(new URLSearchParams("status=gone&trigger=x&sort=size&page=0&pageSize=7"))).toEqual(base);
    expect(parseAnalysesListState(new URLSearchParams(""))).toEqual(base);
  });
});

describe("analysesListSearch", () => {
  it("leaves the defaults out of the address", () => {
    expect(analysesListSearch(base)).toBe("");
  });

  it("round trips a filtered state", () => {
    const state: AnalysesListState = { search: "clima", status: "active", trigger: "message_count", groupId: "g9", sort: "oldest", page: 2, pageSize: 25 };
    expect(parseAnalysesListState(new URLSearchParams(analysesListSearch(state)))).toEqual(state);
  });
});

describe("hasFilters", () => {
  it("counts search, status, trigger and group", () => {
    expect(hasFilters(base)).toBe(false);
    expect(hasFilters({ ...base, search: "x" })).toBe(true);
    expect(hasFilters({ ...base, status: "archived" })).toBe(true);
    expect(hasFilters({ ...base, trigger: "scheduled" })).toBe(true);
    expect(hasFilters({ ...base, groupId: "g1" })).toBe(true);
  });

  it("ignores the sort, which never excludes rows", () => {
    expect(hasFilters({ ...base, sort: "name" })).toBe(false);
  });
});

describe("request params", () => {
  it("sends the page and drops an empty search", () => {
    expect(listParams({ ...base, page: 2 })).toEqual({ page: 2, pageSize: DEFAULT_ANALYSES_PAGE_SIZE, sort: "recent" });
    expect(listParams({ ...base, search: "vendas", status: "active", groupId: "g1" })).toEqual({
      page: 1,
      pageSize: DEFAULT_ANALYSES_PAGE_SIZE,
      sort: "recent",
      search: "vendas",
      status: "active",
      groupId: "g1",
    });
  });

  it("asks for a single row per status count, keeping the other filters", () => {
    expect(countParams({ ...base, status: "active", trigger: "scheduled", search: "x", page: 4 }, "paused")).toEqual({
      page: 1,
      pageSize: 1,
      status: "paused",
      trigger: "scheduled",
      search: "x",
    });
  });
});

describe("pageAfterRemoval", () => {
  it("steps back a page when the last row of a later page goes", () => {
    expect(pageAfterRemoval(3, 1)).toBe(2);
    expect(pageAfterRemoval(3, 4)).toBe(3);
    expect(pageAfterRemoval(1, 1)).toBe(1);
  });
});
