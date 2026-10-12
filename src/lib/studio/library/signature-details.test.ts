import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

import { elementPlan } from "../agent/element-ops";
import { VIDEO_ASPECT_SIZES, type Layer } from "../document";
import { GRAPHICS_CATEGORY } from "./builtin/graphics";
import { TEXT_COMBOS, TEXT_COMBOS_CATEGORY } from "./builtin/text-combos";
import { labelText } from "./catalog";
import { DIAL_SPECS, ORNAMENT_SPECS } from "./decor/ornaments";
import { imageContent, videoClips, type LibraryRequest } from "./instantiate";
import { LIBRARY_INK, type LibraryItem } from "./model";
import { layerColors } from "./placement";
import { PREVIEW_INK } from "./preview";
import { loadItems } from "./store";

const SQUARE = VIDEO_ASPECT_SIZES.square;
const MESSAGES = { pt, en, es, de };

function request(extra: Partial<LibraryRequest> = {}): LibraryRequest {
  return { canvas: SQUARE, locale: "pt", text: () => "", ...extra };
}

function coordinates(path: string): { x: number; y: number }[] {
  const numbers = (path.match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
  return Array.from({ length: Math.floor(numbers.length / 2) }, (_, i) => ({ x: numbers[i * 2], y: numbers[i * 2 + 1] }));
}

function message(locale: keyof typeof MESSAGES, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined), MESSAGES[locale]);
}

async function graphics(subcategory: string): Promise<LibraryItem[]> {
  return (await loadItems(GRAPHICS_CATEGORY)).filter((item) => item.subcategory === subcategory);
}

describe("ornament frames", () => {
  it("ship art deco, filete, classic double line and botanical styles as graphics", async () => {
    const ids = (await graphics("ornaments")).map((item) => item.id);
    for (const style of ["deco", "filete", "double-line", "botanical"]) expect(ids.some((id) => id.includes(style)), style).toBe(true);
  });

  it("leave the middle of the top edge open for a title", () => {
    for (const spec of ORNAMENT_SPECS) {
      const drawn = spec.draw({ ink: LIBRARY_INK.image, canvas: SQUARE });
      for (const [path] of drawn.p) {
        for (const point of coordinates(path)) {
          const inGap = point.y < drawn.h * 0.14 && Math.abs(point.x - drawn.w / 2) < drawn.w * 0.15;
          expect(inGap, `${spec.id} at ${point.x},${point.y}`).toBe(false);
        }
      }
    }
  });

  it("paint every stroke in the editor ink so one color change restyles the frame", async () => {
    for (const item of await graphics("ornaments")) expect(layerColors(imageContent(item, request())!.layers), item.id).toEqual([LIBRARY_INK.image]);
  });
});

describe("dials", () => {
  it("ship a spending gauge, a progress ring and a radial meter", async () => {
    const ids = (await graphics("dials")).map((item) => item.id);
    for (const kind of ["gauge", "ring", "meter"]) expect(ids.some((id) => id.includes(kind)), kind).toBe(true);
    expect(DIAL_SPECS.length).toBeGreaterThanOrEqual(3);
  });

  it("separate the track from the value color so each can be recolored", async () => {
    for (const item of await graphics("dials")) {
      const colors = layerColors(imageContent(item, request())!.layers);
      expect(colors, item.id).toContain(LIBRARY_INK.image);
      expect(colors.length, item.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("show the track in the preview ink", async () => {
    for (const item of await graphics("dials")) {
      if (item.preview.kind !== "deferred") throw new Error(item.id);
      const preview = await item.preview.load();
      expect(preview.kind === "svg" && preview.markup.includes(PREVIEW_INK), item.id).toBe(true);
    }
  });
});

describe("monogram seals", () => {
  const monograms = TEXT_COMBOS.filter((combo) => combo.subcategory === "monograms");

  it("overlap two or three letters inside a seal with curved text", () => {
    expect(monograms.length).toBeGreaterThanOrEqual(5);
    for (const combo of monograms) {
      expect(combo.backdrop, combo.id).toBeDefined();
      const texts = combo.parts.flatMap((part) => (part.kind === "text" ? [part] : []));
      expect(texts.some((part) => (part.curve ?? 0) !== 0), combo.id).toBe(true);
      const letters = texts.find((part) => part.slot === "letters");
      expect(letters, combo.id).toBeDefined();
      expect(letters!.sample.pt.length, combo.id).toBeGreaterThanOrEqual(2);
      expect(letters!.sample.pt.length, combo.id).toBeLessThanOrEqual(3);
      expect(letters!.spacing ?? 0, combo.id).toBeLessThan(0);
    }
  });

  it("swap the letters and the curved words through add_element texts", () => {
    const items = new Map((TEXT_COMBOS_CATEGORY.items() as readonly LibraryItem[]).map((item) => [item.id, item]));
    for (const combo of monograms) {
      const curved = combo.parts.find((part) => part.kind === "text" && (part.curve ?? 0) !== 0)!;
      const slot = curved.kind === "text" ? curved.slot : "";
      const plan = elementPlan({ item_id: `text-combo-${combo.id}`, texts: [{ slot: "letters", text: "JM" }, { slot, text: "CASA DE CHÁ" }] }, "image", { items, text: (label) => labelText(label, (key) => key, "pt"), locale: "pt" });
      if (!plan.ok) throw new Error(plan.reason);
      const texts = imageContent(plan.item, { canvas: SQUARE, locale: plan.locale, text: plan.text })!.layers.filter((layer): layer is Layer => layer.type === "text").map((layer) => layer.text);
      expect(texts, combo.id).toContain("JM");
      expect(texts, combo.id).toContain("CASA DE CHÁ");
    }
  });

  it("insert in both editors", () => {
    for (const combo of monograms) {
      const item = (TEXT_COMBOS_CATEGORY.items() as readonly LibraryItem[]).find((entry) => entry.id === `text-combo-${combo.id}`)!;
      expect(item.editors).toEqual(["image", "video"]);
      expect(videoClips(item, { ...request(), atMs: 0, documentMs: 5000 })?.length, item.id).toBeGreaterThan(1);
    }
  });
});

describe("signature detail labels", () => {
  it("name the new groups in the four languages", () => {
    for (const locale of ["pt", "en", "es", "de"] as const) {
      for (const key of ["studio.library.subcategories.graphics.ornaments", "studio.library.subcategories.graphics.dials", "studio.library.subcategories.combos.monograms"]) {
        expect(typeof message(locale, key), `${locale} ${key}`).toBe("string");
      }
    }
  });
});
