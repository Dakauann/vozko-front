import { addDays, civilToday, isDay, zonedDayStart } from "@/lib/advertising/date-range";
import { LOWEST_COST, bidFromInput, parseRoas, type BidInput, type BudgetInput } from "@/lib/advertising/draft";
import type { AdBid, AdBudget, AdDayPart, AdDraftTargeting, AdPlacements } from "@/lib/advertising/draft-types";
import { inputToMinor, minorToInput } from "@/lib/advertising/money";
import type { AdEditableObject, AdObjectEdit } from "@/lib/advertising/types";

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

export function buildObjectEdit(original: EditForm, current: EditForm, timezone: string, currency: string): AdObjectEdit {
  const edit: AdObjectEdit = {};
  const name = current.name.trim();
  if (name !== original.name.trim()) edit.name = name;
  if (current.budget && original.budget) {
    const amount = inputToMinor(current.budget.input, currency);
    if (amount !== null && amount !== inputToMinor(original.budget.input, currency)) edit.budget = { kind: original.budget.kind, amount };
  }
  if (current.bid && original.bid) {
    const bid = bidFromInput(current.bid, currency);
    if (!sameValue(bid, bidFromInput(original.bid, currency))) edit.bid = bid;
  }
  if (current.endDay && current.endDay !== original.endDay) {
    const endAt = endAtOf(current.endDay, timezone);
    if (endAt) edit.endAt = endAt;
  }
  if (current.schedule.length > 0 && !sameValue(current.schedule, original.schedule)) edit.schedule = current.schedule;
  if (current.targeting && !sameValue(current.targeting, original.targeting)) edit.targeting = current.targeting;
  if (current.placements && !sameValue(current.placements, original.placements)) edit.placements = current.placements;
  return edit;
}

export function editIsEmpty(edit: AdObjectEdit): boolean {
  return Object.keys(edit).length === 0;
}

export function editExpected(expected: Record<string, string> | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(expected ?? {}).map(([field, code]) => [field.replace(/^edit\./, ""), code]));
}
