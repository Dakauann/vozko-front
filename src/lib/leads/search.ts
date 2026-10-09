import { LEAD_FILTER_FIELD, readSet, withSet, type LeadFilter } from "@/lib/leads/filters";
import type { LeadPlacesSection } from "@/lib/leads/sections";

export const LEAD_SEARCH_DEBOUNCE_MS = 300;
export const LEAD_SEARCH_MIN_LENGTH = 2;

export type LeadSearchOption =
  | { kind: "leads"; id: string; query: string }
  | { kind: "district" | "city"; id: string; value: string; name: string; context: string; count: number };

export type LeadPlaceOption = Extract<LeadSearchOption, { kind: "district" | "city" }>;

export function committedLeadSearch(draft: string): string {
  const trimmed = draft.trim();
  return trimmed.length >= LEAD_SEARCH_MIN_LENGTH ? trimmed : "";
}

export function leadSearchOptions(draft: string, places: LeadPlacesSection | null): LeadSearchOption[] {
  const query = committedLeadSearch(draft);
  if (query === "") return [];
  const options: LeadSearchOption[] = [{ kind: "leads", id: "leads", query }];
  for (const district of places?.districts ?? []) {
    options.push({
      kind: "district",
      id: `district:${district.pair}`,
      value: district.pair,
      name: district.district,
      context: district.city,
      count: district.count,
    });
  }
  for (const city of places?.cities ?? []) {
    options.push({
      kind: "city",
      id: `city:${city.cityKey}`,
      value: city.cityKey,
      name: city.city,
      context: city.state,
      count: city.count,
    });
  }
  return options;
}

export function withPickedPlace(filter: LeadFilter, option: LeadPlaceOption): LeadFilter {
  const field = option.kind === "district" ? LEAD_FILTER_FIELD.district : LEAD_FILTER_FIELD.city;
  const current = readSet(filter, field);
  return current.includes(option.value) ? filter : withSet(filter, field, [...current, option.value]);
}
