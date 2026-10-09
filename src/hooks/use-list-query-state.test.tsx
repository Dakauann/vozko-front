import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const location = { search: "" };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/dashboard/leads",
  useSearchParams: () => new URLSearchParams(location.search),
}));

import { encodeFilterParam } from "@/lib/crm/board";

import { useListQueryState } from "./use-list-query-state";

const VIEWS = ["table", "map"] as const;

function renderState(search: string) {
  location.search = search;
  return renderHook(() =>
    useListQueryState<"createdAt", (typeof VIEWS)[number]>({
      sortKeys: ["createdAt"],
      views: VIEWS,
      defaultView: "table",
    }),
  );
}

describe("useListQueryState view", () => {
  beforeEach(() => {
    replace.mockReset();
  });

  it("opens on the default view when the URL names none", () => {
    expect(renderState("").result.current.view).toBe("table");
  });

  it("reads the view from the URL", () => {
    expect(renderState("view=map").result.current.view).toBe("map");
  });

  it("falls back to the default view for a view it does not know", () => {
    expect(renderState("view=globe").result.current.view).toBe("table");
  });

  it("writes the view next to the filter, search and page it keeps", () => {
    const { result } = renderState("filter=abc&q=maria&page=3");
    result.current.setView("map");
    expect(replace).toHaveBeenCalledWith("/dashboard/leads?filter=abc&q=maria&page=3&view=map", { scroll: false });
  });

  it("drops the view from the URL when it goes back to the default", () => {
    const { result } = renderState("q=maria&view=map");
    result.current.setView("table");
    expect(replace).toHaveBeenCalledWith("/dashboard/leads?q=maria", { scroll: false });
  });

  it("keeps the view when the filter or the search change", () => {
    const { result } = renderState("view=map&page=2");
    result.current.setSearch("joana");
    expect(replace).toHaveBeenCalledWith("/dashboard/leads?view=map&q=joana", { scroll: false });
  });

  it("keeps the view when the filters are cleared", () => {
    const { result } = renderState("view=map&q=maria");
    result.current.clearFilters();
    expect(replace).toHaveBeenCalledWith("/dashboard/leads?view=map", { scroll: false });
  });

  it("switches view and filter in one URL change so neither overwrites the other", () => {
    const { result } = renderState("view=map&q=maria&page=2");
    const filter = { groups: [{ conjunction: "and" as const, predicates: [{ field: "has_address", operator: "is_false", values: [] }] }] };
    result.current.setView("table", filter);
    expect(replace).toHaveBeenCalledTimes(1);
    const url = new URL(replace.mock.calls[0][0], "http://x");
    expect(url.searchParams.get("view")).toBeNull();
    expect(url.searchParams.get("q")).toBe("maria");
    expect(url.searchParams.get("page")).toBeNull();
    expect(url.searchParams.get("filter")).toBe(encodeFilterParam(filter));
  });

  it("tells a view the URL names apart from the default one", () => {
    expect(renderState("").result.current.viewChosen).toBe(false);
    expect(renderState("view=globe").result.current.viewChosen).toBe(false);
    expect(renderState("view=table").result.current.viewChosen).toBe(true);
    expect(renderState("view=map").result.current.viewChosen).toBe(true);
  });

  it("has no view for a list that declares none", () => {
    location.search = "view=map";
    const { result } = renderHook(() => useListQueryState<"createdAt">({ sortKeys: ["createdAt"] }));
    expect(result.current.view).toBeUndefined();
    expect(result.current.viewChosen).toBe(false);
  });
});

describe("useListQueryState view-scoped params", () => {
  beforeEach(() => {
    replace.mockReset();
  });

  function renderScoped(search: string) {
    location.search = search;
    return renderHook(() =>
      useListQueryState<"createdAt", (typeof VIEWS)[number]>({
        sortKeys: ["createdAt"],
        views: VIEWS,
        defaultView: "table",
        viewScopedParams: ["focus"],
      }),
    );
  }

  it("drops a parameter that belongs to the view it leaves", () => {
    const { result } = renderScoped("view=map&focus=lead-1&q=maria");
    result.current.setView("table");
    expect(replace).toHaveBeenCalledWith("/dashboard/leads?q=maria", { scroll: false });
  });

  it("drops it too when the view changes with a filter", () => {
    const { result } = renderScoped("view=map&focus=lead-1");
    result.current.setView("table", { groups: [{ conjunction: "and", predicates: [{ field: "blocked", operator: "is_true", values: [] }] }] });
    expect(new URL(replace.mock.calls[0][0], "http://x").searchParams.get("focus")).toBeNull();
  });

  it("keeps it when the filter or the search change inside the view", () => {
    const { result } = renderScoped("view=map&focus=lead-1");
    result.current.setSearch("joana");
    expect(new URL(replace.mock.calls[0][0], "http://x").searchParams.get("focus")).toBe("lead-1");
  });
});

describe("useListQueryState filter link", () => {
  const stage = { groups: [{ conjunction: "and" as const, predicates: [{ field: "stage", operator: "in", values: ["s-1"] }] }] };

  it("reads a valid filter link", () => {
    const { result } = renderState(`filter=${encodeURIComponent(encodeFilterParam(stage))}`);
    expect(result.current.filter).toEqual(stage);
    expect(result.current.filterInvalid).toBe(false);
  });

  it("is not invalid without a filter", () => {
    expect(renderState("").result.current.filterInvalid).toBe(false);
  });

  it("flags a broken filter link and falls back to the empty filter", () => {
    const { result } = renderState("filter=%25%25not-a-filter");
    expect(result.current.filterInvalid).toBe(true);
    expect(result.current.filter).toEqual({ groups: [] });
  });
});

describe("useListQueryState filter and sort together", () => {
  const stage = { groups: [{ conjunction: "and" as const, predicates: [{ field: "stage", operator: "in", values: ["s-1"] }] }] };

  beforeEach(() => {
    replace.mockReset();
  });

  it("writes a saved view's filter and sort in one URL change so neither overwrites the other", () => {
    const { result } = renderState("q=maria&page=3&view=map");
    result.current.setFilterAndSorts(stage, [{ key: "createdAt", direction: "asc" }]);
    expect(replace).toHaveBeenCalledTimes(1);
    const url = new URL(replace.mock.calls[0][0], "http://x");
    expect(url.searchParams.get("filter")).toBe(encodeFilterParam(stage));
    expect(url.searchParams.get("sort")).toBe("createdAt:asc");
    expect(url.searchParams.get("q")).toBe("maria");
    expect(url.searchParams.get("view")).toBe("map");
    expect(url.searchParams.get("page")).toBeNull();
  });

  it("keeps the current sort when the view brings none", () => {
    const { result } = renderState("sort=createdAt%3Aasc");
    result.current.setFilterAndSorts(stage);
    const url = new URL(replace.mock.calls[0][0], "http://x");
    expect(url.searchParams.get("sort")).toBe("createdAt:asc");
    expect(url.searchParams.get("filter")).toBe(encodeFilterParam(stage));
  });
});

describe("useListQueryState search and place", () => {
  const district = { groups: [{ conjunction: "and" as const, predicates: [{ field: "district", operator: "in", values: ["rn:natal/santo antonio"] }] }] };

  beforeEach(() => {
    replace.mockReset();
  });

  it("swaps the search for a filter chip in one URL change", () => {
    const { result } = renderState("q=santo&page=2");
    result.current.setFilterAndSearch(district, "");
    expect(replace).toHaveBeenCalledTimes(1);
    const url = new URL(replace.mock.calls[0][0], "http://x");
    expect(url.searchParams.get("filter")).toBe(encodeFilterParam(district));
    expect(url.searchParams.has("q")).toBe(false);
    expect(url.searchParams.has("page")).toBe(false);
  });

  it("tells a chosen sort apart from the default one", () => {
    expect(renderState("").result.current.sortsChosen).toBe(false);
    expect(renderState("sort=unknown%3Aasc").result.current.sortsChosen).toBe(false);
    expect(renderState("sort=createdAt%3Aasc").result.current.sortsChosen).toBe(true);
  });
});
