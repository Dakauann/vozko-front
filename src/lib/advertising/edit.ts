import { addDays, civilToday, isDay, zonedDayStart } from "@/lib/advertising/date-range";
import { LOWEST_COST, bidFromInput, parseRoas, type BidInput, type BudgetInput } from "@/lib/advertising/draft";
import type { AdBid, AdBudget, AdDayPart, AdDraftTargeting, AdPlacements } from "@/lib/advertising/draft-types";
import { inputToMinor, minorToInput } from "@/lib/advertising/money";
import type { AdEditableObject, AdLevel, AdObjectEdit } from "@/lib/advertising/types";

export interface EditForm {
  name: string;
  budget: BudgetInput | null;
  bid: BidInput | null;
  endDay: string;
  schedule: AdDayPart[];
  targeting: AdDraftTargeting | null;
  placements: AdPlacements | null;
}

export type EditInputProblem = "name" | "budget" | "bidAmount" | "roasFloor";

export function budgetInputOf(budget: AdBudget | null, currency: string): BudgetInput | null {
  return budget ? { kind: budget.kind, input: minorToInput(budget.amount, currency) } : null;
}

export function bidInputOf(bid: AdBid | null, currency: string): BidInput {
  return {
    strategy: bid?.strategy || LOWEST_COST,
    amountInput: bid?.amount ? minorToInput(bid.amount, currency) : "",
    roasInput: bid?.roasFloor ? String(bid.roasFloor).replace(".", ",") : "",
  };
}

export function startDayOf(iso: string | null | undefined, timezone: string): string {
  if (!iso) return "";
  const instant = Date.parse(iso);
  if (Number.isNaN(instant)) return "";
  return civilToday(timezone, new Date(instant)) ?? "";
}

export function endDayOf(iso: string | null | undefined, timezone: string): string {
  if (!iso) return "";
  const instant = Date.parse(iso);
  if (Number.isNaN(instant)) return "";
  return civilToday(timezone, new Date(instant - 1)) ?? "";
}

export function endAtOf(day: string, timezone: string): string | null {
  if (!isDay(day)) return null;
  return zonedDayStart(addDays(day, 1), timezone);
}

export function expandPlacements(placements: AdPlacements | null, catalog: Record<string, string[]>): AdPlacements | null {
  if (!placements || placements.automatic) return placements;
  const positions: Record<string, string[]> = {};
  for (const platform of placements.platforms ?? []) {
    const chosen = placements.positions?.[platform];
    positions[platform] = chosen?.length ? [...chosen] : [...(catalog[platform] ?? [])];
  }
  return { ...placements, positions };
}

export function manualPlacements(placements: AdPlacements, catalog: Record<string, string[]>): AdPlacements {
  return {
    automatic: false,
    platforms: Object.keys(catalog),
    positions: Object.fromEntries(Object.entries(catalog).map(([platform, positions]) => [platform, [...positions]])),
    devices: placements.devices,
  };
}

export function editFormOf(
  detail: AdEditableObject,
  timezone: string,
  placementCatalog: Record<string, string[]>,
  currency: string,
): EditForm {
  const { row } = detail;
  const notAd = row.level !== "ad";
  return {
    name: row.name,
    budget: notAd ? budgetInputOf(detail.budget, currency) : null,
    bid: notAd ? bidInputOf(detail.bid, currency) : null,
    endDay: notAd ? endDayOf(row.endTime, timezone) : "",
    schedule: detail.schedule ?? [],
    targeting: row.level === "adset" ? detail.targeting : null,
    placements: row.level === "adset" ? expandPlacements(detail.placements, placementCatalog) : null,
  };
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined && item !== null && !(Array.isArray(item) && item.length === 0))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonical(item)]);
    return Object.fromEntries(entries);
  }
  return value;
}

export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

export function editInputProblems(form: EditForm, currency: string): EditInputProblem[] {
  const problems: EditInputProblem[] = [];
  if (!form.name.trim()) problems.push("name");
  if (form.budget && inputToMinor(form.budget.input, currency) === null) problems.push("budget");
  if (form.bid) {
    const { strategy } = form.bid;
    if ((strategy === "LOWEST_COST_WITH_BID_CAP" || strategy === "COST_CAP") && inputToMinor(form.bid.amountInput, currency) === null) {
      problems.push("bidAmount");
    }
    if (strategy === "LOWEST_COST_WITH_MIN_ROAS" && parseRoas(form.bid.roasInput) === null) problems.push("roasFloor");
  }
  return problems;
}

export type EditField = keyof EditForm;

const EDIT_FIELDS: EditField[] = ["name", "budget", "bid", "endDay", "schedule", "targeting", "placements"];

export type EditGroup = "name" | "budgetBid" | "endDay" | "schedule" | "targeting" | "placements";

export const EDIT_GROUP_FIELDS: Record<EditGroup, EditField[]> = {
  name: ["name"],
  budgetBid: ["budget", "bid"],
  endDay: ["endDay"],
  schedule: ["schedule"],
  targeting: ["targeting"],
  placements: ["placements"],
};

const LEVEL_GROUPS: Record<AdLevel, EditGroup[]> = {
  campaign: ["name", "budgetBid"],
  adset: ["name", "budgetBid", "endDay", "schedule", "targeting", "placements"],
  ad: ["name"],
};

export function editGroupsFor(level: AdLevel): EditGroup[] {
  return [...LEVEL_GROUPS[level]];
}

export function fieldEdit(field: EditField, baseline: EditForm, current: EditForm, timezone: string, currency: string): AdObjectEdit {
  switch (field) {
    case "name":
      return { name: current.name.trim() };
    case "budget": {
      const amount = current.budget ? inputToMinor(current.budget.input, currency) : null;
      return amount !== null && baseline.budget ? { budget: { kind: baseline.budget.kind, amount } } : {};
    }
    case "bid":
      return current.bid && baseline.bid ? { bid: bidFromInput(current.bid, currency) } : {};
    case "endDay": {
      const endAt = current.endDay ? endAtOf(current.endDay, timezone) : null;
      return endAt ? { endAt } : {};
    }
    case "schedule":
      return current.schedule.length > 0 ? { schedule: current.schedule } : {};
    case "targeting":
      return current.targeting ? { targeting: current.targeting } : {};
    case "placements":
      return current.placements ? { placements: current.placements } : {};
  }
}

export function fieldChanged(field: EditField, original: EditForm, current: EditForm, timezone: string, currency: string): boolean {
  const after = fieldEdit(field, original, current, timezone, currency);
  return !editIsEmpty(after) && !sameValue(fieldEdit(field, original, original, timezone, currency), after);
}

export function buildObjectEdit(original: EditForm, current: EditForm, timezone: string, currency: string): AdObjectEdit {
  return EDIT_FIELDS.filter((field) => fieldChanged(field, original, current, timezone, currency)).reduce<AdObjectEdit>(
    (edit, field) => ({ ...edit, ...fieldEdit(field, original, current, timezone, currency) }),
    {},
  );
}

export function editIsEmpty(edit: AdObjectEdit): boolean {
  return Object.keys(edit).length === 0;
}

export function editExpected(expected: Record<string, string> | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(expected ?? {}).map(([field, code]) => [field.replace(/^edit\./, ""), code]));
}
