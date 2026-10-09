import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import { LEAD_FILTER_FIELDS, LEAD_FILTER_FIELD, LEAD_GEO_STATUSES } from "@/lib/leads/filters";
import { offMapRows, presentOffMapKeys } from "@/lib/maps/summary";
import { GEOCODING_PAUSE_REASONS } from "@/lib/workspace/workspace-config/geocoding";

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

const everyCount = { total: 1, onMap: 0, approximate: 1, withoutAddress: 1, notFound: 1, pending: 1, quotaExceeded: 1, refused: 1 };

const everyOffMapKey = offMapRows(everyCount).map((row) => row.key);

describe("geo labels", () => {
  it("knows the refused status the server sends", () => {
    expect(LEAD_GEO_STATUSES).toContain("refused");
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

  it.each(presentOffMapKeys(everyCount))("labels the %s count of the empty map in every locale", (key) => {
    expectLabelled(`leadMap.empty.counts.${key}`);
  });

  it.each(["location_pinned", "location_accepted"])("labels the %s record event in every locale", (event) => {
    expectLabelled(`leadDetail.timeline.record.${event}`);
  });

  it.each([...GEOCODING_PAUSE_REASONS, "other"])("explains the %s provider pause in every locale", (reason) => {
    expectLabelled(`workspaceSettings.geocoding.pause.reasons.${reason}`);
  });

  it.each(["status.providerPaused", "status.providerPauseUnknown", "pause.title", "pause.unknownTitle", "pause.since", "pause.until", "pause.unknown", "pause.reference"])(
    "has the provider pause text %s in every locale",
    (key) => {
      expectLabelled(`workspaceSettings.geocoding.${key}`);
    },
  );
});
