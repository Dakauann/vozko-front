import { deliveryKey, rowIssues } from "./delivery";
import type { TableRow } from "./manager-drafts";
import type { AdRow } from "./types";

export const QUICK_VIEWS = ["all", "active", "issues", "delivered"] as const;

export type QuickView = (typeof QUICK_VIEWS)[number];

function needsAttention(row: TableRow): boolean {
  const delivery = deliveryKey(row.delivery);
  return delivery === "rejected" || delivery === "with_issues" || rowIssues(row).length > 0;
}

export function matchesView(row: TableRow, view: QuickView): boolean {
  if (view === "all") return true;
  if (row.draft) return view === "issues" && row.draft.state === "failed";
  switch (view) {
    case "active":
      return deliveryKey(row.delivery) === "active";
    case "issues":
      return needsAttention(row);
    case "delivered":
      return row.metrics.impressions > 0;
  }
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase();
}

export function matchesSearch(row: Pick<AdRow, "name" | "metaId">, term: string): boolean {
  const needle = fold(term.trim());
  if (!needle) return true;
  return fold(row.name).includes(needle) || row.metaId.includes(needle);
}

export function filterRows(rows: TableRow[], view: QuickView, term: string): TableRow[] {
  return rows.filter((row) => matchesView(row, view) && (!row.draft || matchesSearch(row, term)));
}
