import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

import { LINT_CODES } from "./lint-codes";

const BACKEND_GOLDEN = resolve(__dirname, "../../../../vozko-back/domain/workflow/testdata/lint_codes.golden");
const CATALOGS: Record<string, unknown> = { pt, en, es, de };

function lintCatalog(messages: unknown): Record<string, unknown> {
  const page = (messages as Record<string, Record<string, unknown>>).workflowsPage;
  return (page?.lint ?? {}) as Record<string, unknown>;
}

function copyField(entry: unknown, field: "title" | "fix"): unknown {
  return entry && typeof entry === "object" ? (entry as Record<string, unknown>)[field] : undefined;
}

describe("lint codes", () => {
  it("lists every code once, sorted, so a diff against the backend golden stays readable", () => {
    expect([...LINT_CODES].sort()).toEqual([...LINT_CODES]);
    expect(new Set(LINT_CODES).size).toBe(LINT_CODES.length);
  });

  it.each(Object.keys(CATALOGS))("gives every code a title and a fix in %s", (locale) => {
    const catalog = lintCatalog(CATALOGS[locale]);
    const missing = LINT_CODES.filter((code) => {
      const entry = catalog[code];
      const title = copyField(entry, "title");
      const fix = copyField(entry, "fix");
      return typeof title !== "string" || !title.trim() || typeof fix !== "string" || !fix.trim();
    });
    expect(missing).toEqual([]);
  });

  it.each(Object.keys(CATALOGS))("keeps no copy in %s for a code the backend no longer sends", (locale) => {
    const stale = Object.keys(lintCatalog(CATALOGS[locale])).filter((code) => !LINT_CODES.includes(code));
    expect(stale).toEqual([]);
  });

  it.skipIf(!existsSync(BACKEND_GOLDEN))("matches the codes the backend declares in its golden file", () => {
    const golden = readFileSync(BACKEND_GOLDEN, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    expect([...LINT_CODES]).toEqual(golden);
  });
});
