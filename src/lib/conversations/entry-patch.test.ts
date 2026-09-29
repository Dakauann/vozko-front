import { describe, expect, it } from "vitest";

import { patchColumns, patchEntries } from "./entry-patch";
import type { InboxEntry } from "./types";

function entry(id: string, type = "whatsapp"): InboxEntry {
  return { entry_id: id, entry_type: type, lead_name: id } as InboxEntry;
}

const rename = (e: InboxEntry): InboxEntry => ({ ...e, lead_name: "patched" });

describe("patchEntries", () => {
  it("patches only the entry with the same id and type", () => {
    const out = patchEntries([entry("a"), entry("a", "instagram"), entry("b")], "a", "whatsapp", rename);
    expect(out.map((e) => e.lead_name)).toEqual(["patched", "a", "b"]);
  });
});

describe("patchColumns", () => {
  it("patches the entry in whichever column holds it", () => {
    const columns = new Map([
      ["s1", { entries: [entry("a")] }],
      ["s2", { entries: [entry("b")] }],
    ]);
    const out = patchColumns(columns, "b", "whatsapp", rename);
    expect(out.get("s2")?.entries?.[0].lead_name).toBe("patched");
    expect(out.get("s1")).toBe(columns.get("s1"));
  });

  it("returns the same map when no column holds the entry, so nothing re-renders", () => {
    const columns = new Map([["s1", { entries: [entry("a")] }]]);
    expect(patchColumns(columns, "zzz", "whatsapp", rename)).toBe(columns);
  });
});
