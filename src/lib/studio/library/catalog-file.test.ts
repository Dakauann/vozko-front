import { describe, expect, it } from "vitest";

import { CATALOG_VERSION, catalogJson, type CatalogItem } from "./catalog-file";

const body = {
  category: "icons",
  panel: "elements",
  editors: ["image", "video"],
  kind: "layers",
  ratio: 1,
  names: { pt: "Bolota", en: "Acorn", es: "Bellota", de: "Eichel" },
  tags: { en: ["nut"] },
  colors: { image: ["#111111"], video: ["#ffffff"] },
  source: { set: "phosphor", license: "MIT" },
} satisfies Omit<CatalogItem, "id">;

const own: CatalogItem = { ...body, id: "null", category: "controls", names: { pt: "Nulo", en: "Null", es: "Nulo", de: "Null-Objekt" }, tags: { en: ["controller"] } };

function expand(json: string): CatalogItem[] {
  const file = JSON.parse(json) as { shared?: Omit<CatalogItem, "id">[]; items: (CatalogItem | { id: string; subcategory?: string; base: number; names?: CatalogItem["names"] })[] };
  return file.items.map((entry) => ("base" in entry ? ({ ...file.shared![entry.base], ...entry, base: undefined } as unknown as CatalogItem) : entry)).map((item) => JSON.parse(JSON.stringify(item)) as CatalogItem);
}

describe("the catalog file", () => {
  it("writes a body repeated by several items once and keeps the item order", () => {
    const items: CatalogItem[] = [
      { ...body, id: "icon-acorn-regular", subcategory: "regular" },
      own,
      { ...body, id: "icon-acorn-bold", subcategory: "bold", names: { pt: "Bolota (negrito)", en: "Acorn (bold)", es: "Bellota (negrita)", de: "Eichel (fett)" } },
    ];
    const json = catalogJson({ version: CATALOG_VERSION, categories: [], items });
    const file = JSON.parse(json) as { version: number; shared: unknown[]; items: unknown[] };
    expect(file.version).toBe(2);
    expect(file.shared).toHaveLength(1);
    expect(json.match(/"nut"/g)).toHaveLength(1);
    expect(file.items[0]).toEqual({ id: "icon-acorn-regular", subcategory: "regular", base: 0 });
    expect(file.items[1]).toEqual(own);
    expect(file.items[2]).toEqual({ id: "icon-acorn-bold", subcategory: "bold", base: 0, names: items[2].names });
    expect(expand(json)).toEqual(items);
  });

  it("leaves a body used once inline and writes no shared list when nothing repeats", () => {
    const json = catalogJson({ version: CATALOG_VERSION, categories: [], items: [own] });
    expect(JSON.parse(json)).toEqual({ version: CATALOG_VERSION, categories: [], items: [own] });
  });
});
