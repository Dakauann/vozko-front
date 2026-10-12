import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import { CATALOG_PATHS, catalogFiles, translatorOf } from "@/lib/studio/library/catalog-file";
import { LIBRARY_ID_PATTERN, LIBRARY_LOCALES, OWN_SOURCE } from "@/lib/studio/library/model";
import { PREVIEW_INK } from "@/lib/studio/library/preview";
import { loadAllItems } from "@/lib/studio/library/store";
import { documentIssue } from "@/lib/studio/validate";

import { LIBRARY_CATEGORIES } from "./registry";

const ROOT = resolve(__dirname, "../../../../..");
const MESSAGES = { pt, en, es, de };
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function committed(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf8").replace(/\r\n/g, "\n");
}

describe("the library catalog", () => {
  it("gives every item a unique token id, a known category and at least one editor", async () => {
    const items = await loadAllItems(LIBRARY_CATEGORIES);
    const categories = new Set(LIBRARY_CATEGORIES.map((category) => category.id));
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    for (const item of items) {
      expect(item.id, item.id).toMatch(LIBRARY_ID_PATTERN);
      expect(categories.has(item.category), item.id).toBe(true);
      expect(item.editors.length, item.id).toBeGreaterThan(0);
      expect(item.ratio, item.id).toBeGreaterThan(0);
      if (item.template.kind === "clips") expect(item.editors, item.id).toEqual(["video"]);
    }
  });

  it("names every item, category, subcategory and text sample in the four languages", async () => {
    const translate = translatorOf(MESSAGES);
    const items = await loadAllItems(LIBRARY_CATEGORIES);
    const labels = [
      ...LIBRARY_CATEGORIES.flatMap((category) => [category.label, ...(category.subcategories ?? []).map((sub) => sub.label), ...Object.values(category.notes ?? {})]),
      ...items.flatMap((item) => [item.label, ...(item.hint ? [item.hint] : []), ...(item.template.slots ?? []).map((slot) => slot.sample)]),
    ];
    for (const label of labels) {
      for (const locale of LIBRARY_LOCALES) expect(() => ("key" in label ? translate(locale, label.key) : label.text[locale])).not.toThrow();
    }
  });

  it("matches the files the backend embeds and validates", { timeout: 30_000 }, async () => {
    const files = await catalogFiles(LIBRARY_CATEGORIES, MESSAGES);
    for (const [name, path] of Object.entries(CATALOG_PATHS)) {
      expect(committed(path), `${path} is stale; run bun run studio:library`).toBe(files[name as keyof typeof CATALOG_PATHS]);
    }
  });

  it("draws every vector preview as a standalone SVG document painted in the preview ink", { timeout: 30_000 }, async () => {
    const items = await loadAllItems(LIBRARY_CATEGORIES);
    const firsts = new Set(LIBRARY_CATEGORIES.map((category) => items.find((item) => item.category === category.id)?.id));
    for (const item of items) {
      const loads = item.preview.kind === "deferred" && (firsts.has(item.id) || item.source.license === OWN_SOURCE.license);
      const preview = item.preview.kind !== "deferred" ? item.preview : loads ? await item.preview.load() : null;
      if (preview?.kind !== "svg") continue;
      const root = new DOMParser().parseFromString(preview.markup, "image/svg+xml").documentElement;
      expect(root.namespaceURI, item.id).toBe(SVG_NAMESPACE);
      expect(root.getAttribute("fill"), item.id).toBe(PREVIEW_INK);
    }
  });

  it("inserts every item into documents the editor accepts", () => {
    expect(documentIssue("image", JSON.parse(committed(CATALOG_PATHS.image)))).toBeNull();
    expect(documentIssue("video", JSON.parse(committed(CATALOG_PATHS.video)))).toBeNull();
  });
});
