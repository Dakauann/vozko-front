import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import { LEAD_FILTER_FIELDS, LEAD_FILTER_FIELD, LEAD_GEO_STATUSES } from "@/lib/leads/filters";
import { offMapRows } from "@/lib/maps/summary";

const LOCALES = { pt, en, es, de } as const;

function textAt(messages: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => (node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined), messages);
}

function expectLabelled(path: string) {
  for (const [locale, messages] of Object.entries(LOCALES)) {
    const text = textAt(messages, path);
    expect(typeof text === "string" && text.trim() !== "", `${locale} ${path}`).toBe(true);
  }
}

const everyCount = { total: 1, onMap: 0, approximate: 1, withoutAddress: 1, notFound: 1, pending: 1 };

const everyOffMapKey = offMapRows(everyCount).map((row) => row.key);

describe("geo labels", () => {
  it("knows exactly the statuses the free IBGE path produces", () => {
    expect([...LEAD_GEO_STATUSES]).toEqual(["pending", "located", "approximate", "not_found", "unavailable"]);
  });

  it("keeps no label for a status only the retired external provider produced", () => {
    for (const messages of Object.values(LOCALES)) {
      for (const status of ["ambiguous", "quota_exceeded", "refused"]) {
        expect(textAt(messages, `leadDetail.address.geoStatus.${status}`)).toBeUndefined();
        expect(textAt(messages, `leadsPage.filters.options.geoStatus.${status}`)).toBeUndefined();
      }
      for (const key of ["quotaExceeded", "refused"]) {
        expect(textAt(messages, `leadMap.summary.${key}`)).toBeUndefined();
        expect(textAt(messages, `leadMap.panel.offMapRows.${key}`)).toBeUndefined();
        expect(textAt(messages, `leadMap.empty.counts.${key}`)).toBeUndefined();
      }
      expect(textAt(messages, "workspaceSettings.geocoding")).toBeUndefined();
      expect(textAt(messages, "leadMap.providers")).toBeUndefined();
    }
  });

  it.each([...LEAD_GEO_STATUSES])("labels the %s status in the address section of every locale", (status) => {
    expectLabelled(`leadDetail.address.geoStatus.${status}`);
  });

  it("offers every geo status as a labelled filter option in every locale", () => {
    const spec = LEAD_FILTER_FIELDS.find((field) => field.field === LEAD_FILTER_FIELD.geoStatus);
    const options = spec?.options ?? [];
    expect(options.map((option) => option.value)).toEqual([...LEAD_GEO_STATUSES]);
    for (const option of options) expectLabelled(option.labelKey ?? "");
  });

  it.each(everyOffMapKey)("labels the off-map %s row and its summary sentence in every locale", (key) => {
    expectLabelled(`leadMap.panel.offMapRows.${key}`);
    expectLabelled(`leadMap.summary.${key}`);
  });

  it.each(["location_pinned", "location_accepted"])("labels the %s record event in every locale", (event) => {
    expectLabelled(`leadDetail.timeline.record.${event}`);
  });
});
