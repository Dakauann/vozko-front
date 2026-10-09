import { describe, expect, it } from "vitest";

import type { SavedView } from "@/lib/crm/saved-views";
import { LEAD_FILTER_FIELD, emptyLeadFilter, toggleInSet } from "@/lib/leads/filters";
import { leadSavedViewInput, savedViewState } from "@/lib/leads/saved-view";
import { LEAD_SORT_KEYS } from "@/lib/leads/types";

const COLUMNS = ["campaigns", "memories", "window"] as const;
const isColumn = (column: string): column is (typeof COLUMNS)[number] => (COLUMNS as readonly string[]).includes(column);

const view = (overrides: Partial<SavedView>): SavedView => ({
  id: "v1",
  name: "Barueri",
  objectType: "lead",
  filter: emptyLeadFilter,
  groupBy: "none",
  isDefault: false,
  position: 0,
  ...overrides,
});

describe("lead saved views", () => {
  it("restores filter, sort and the saved columns", () => {
    const filter = toggleInSet(emptyLeadFilter, LEAD_FILTER_FIELD.city, "sp:barueri");
    const state = savedViewState(
      view({ filter, sortField: "lastActivityAt", sortDir: "asc", columns: ["memories", "window"] }),
      LEAD_SORT_KEYS,
      isColumn,
    );
    expect(state).toEqual({
      filter,
      sort: { key: "lastActivityAt", direction: "asc" },
      columns: ["memories", "window"],
    });
  });

  it("shows only the default columns for a view saved without columns", () => {
    expect(savedViewState(view({ columns: undefined }), LEAD_SORT_KEYS, isColumn).columns).toEqual([]);
  });

  it("drops a column or a sort the page no longer offers", () => {
    const state = savedViewState(view({ sortField: "gone", columns: ["memories", "removed"] }), LEAD_SORT_KEYS, isColumn);
    expect(state.sort).toBeUndefined();
    expect(state.columns).toEqual(["memories"]);
  });

  it("reads a missing filter as the empty filter", () => {
    const state = savedViewState(view({ filter: undefined as unknown as SavedView["filter"] }), LEAD_SORT_KEYS, isColumn);
    expect(state.filter).toEqual(emptyLeadFilter);
  });

  it("saves the columns with the filter and the sort", () => {
    const filter = toggleInSet(emptyLeadFilter, LEAD_FILTER_FIELD.city, "sp:barueri");
    expect(
      leadSavedViewInput({
        name: " Barueri ",
        filter,
        sorts: [{ key: "createdAt", direction: "desc" }],
        columns: ["window"],
      }),
    ).toEqual({
      name: "Barueri",
      objectType: "lead",
      filter,
      groupBy: "none",
      sortField: "createdAt",
      sortDir: "desc",
      columns: ["window"],
      visibility: "private",
    });
  });
});
