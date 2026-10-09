import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { leadFieldLabel } from "../field-label";

const fields = ptMessages.leadSheet.fields as Record<string, string>;

const t = Object.assign((key: string) => fields[key.replace(/^fields\./, "")] ?? key, {
  has: (key: string) => key.replace(/^fields\./, "") in fields,
});

const definitions = [{ key: "interesse", label: "Interesse" }];

describe("leadFieldLabel", () => {
  it("names a record field in the viewer's language", () => {
    expect(leadFieldLabel(t, "birthDate", definitions)).toBe(fields.birthDate);
    expect(leadFieldLabel(t, "relations", definitions)).toBe(fields.relations);
  });

  it("names a custom field by the label the workspace gave it", () => {
    expect(leadFieldLabel(t, "customFields.interesse", definitions)).toBe("Interesse");
  });

  it("falls back to a generic name for a deleted custom field or an unknown field", () => {
    expect(leadFieldLabel(t, "customFields.apagado", definitions)).toBe(fields.customField);
    expect(leadFieldLabel(t, "somethingNew", definitions)).toBe(fields.other);
  });
});
