import { describe, expect, it } from "vitest";

import { elementPlan } from "../../agent/element-ops";
import { VIDEO_ASPECT_SIZES, type CanvasSize, type Layer } from "../../document";
import { FONT_CATEGORIES, STUDIO_FONTS, type FontId } from "../../fonts";
import { layerIssue } from "../../validate";
import { labelText } from "../catalog";
import { imageContent, videoClips, type LibraryRequest } from "../instantiate";
import { LIBRARY_LOCALES, type LibraryItem, type LibraryLocale, type LibrarySlot } from "../model";
import { layerColors } from "../placement";
import { TEXT_COMBOS, TEXT_COMBOS_CATEGORY } from "./text-combos";

const ITEMS = TEXT_COMBOS_CATEGORY.items() as readonly LibraryItem[];
const CANVASES: CanvasSize[] = [VIDEO_ASPECT_SIZES.square, VIDEO_ASPECT_SIZES.story, VIDEO_ASPECT_SIZES.landscape];
const DASHES = /[‒–—―]/u;

function sampleIn(locale: LibraryLocale) {
  return (slot: LibrarySlot) => labelText(slot.sample, (key) => key, locale);
}

function request(canvas: CanvasSize, locale: LibraryLocale): LibraryRequest {
  return { canvas, locale, text: sampleIn(locale) };
}

describe("the text combinations", () => {
  it("ships between thirty and fifty combinations in five groups", () => {
    expect(ITEMS.length).toBeGreaterThanOrEqual(30);
    expect(ITEMS.length).toBeLessThanOrEqual(50);
    expect(new Set(ITEMS.map((item) => item.id)).size).toBe(ITEMS.length);
    for (const sub of TEXT_COMBOS_CATEGORY.subcategories ?? []) expect(ITEMS.filter((item) => item.subcategory === sub.id).length, sub.id).toBeGreaterThanOrEqual(5);
  });

  it("gives the promotions several condensed voices instead of one font for every sale", () => {
    const condensed = new Set<FontId>(["anton", "bebas-neue", "oswald", "staatliches"]);
    const voices = TEXT_COMBOS.filter((combo) => combo.subcategory === "promos").flatMap((combo) => combo.parts.flatMap((part) => (part.kind === "text" && condensed.has(part.font) ? [part.font] : [])));
    expect(new Set(voices).size).toBeGreaterThanOrEqual(3);
    const byCombo = (id: string) => new Set(TEXT_COMBOS.find((combo) => combo.id === id)?.parts.flatMap((part) => (part.kind === "text" ? [part.font] : [])));
    expect([...byCombo("sale-50")].filter((font) => byCombo("black-friday").has(font) && condensed.has(font))).toEqual([]);
  });

  it("writes every name and sample in the four languages without dashes", () => {
    for (const combo of TEXT_COMBOS) {
      for (const locale of LIBRARY_LOCALES) {
        expect(combo.name[locale].trim(), combo.id).not.toBe("");
        expect(combo.name[locale], combo.id).not.toMatch(DASHES);
        for (const part of combo.parts) {
          if (part.kind !== "text") continue;
          expect(part.sample[locale].trim(), `${combo.id} ${part.slot}`).not.toBe("");
          expect(part.sample[locale], `${combo.id} ${part.slot}`).not.toMatch(DASHES);
        }
      }
    }
  });

  it("gives each combination one to four text slots with distinct ids", () => {
    for (const item of ITEMS) {
      const slots = item.template.slots ?? [];
      expect(slots.length, item.id).toBeGreaterThanOrEqual(1);
      expect(slots.length, item.id).toBeLessThanOrEqual(4);
      expect(new Set(slots.map((slot) => slot.id)).size, item.id).toBe(slots.length);
    }
  });

  it("draws on a wide spread of the font catalog, from every category", () => {
    const fonts = new Set<FontId>(TEXT_COMBOS.flatMap((combo) => combo.parts.flatMap((part) => (part.kind === "text" ? [part.font] : []))));
    expect(fonts.size).toBeGreaterThanOrEqual(25);
    for (const category of FONT_CATEGORIES) expect([...fonts].some((id) => STUDIO_FONTS[id].category === category), category).toBe(true);
  });

  it("inserts as one editable group of valid layers on every canvas and in every language", () => {
    for (const item of ITEMS) {
      for (const canvas of CANVASES) {
        for (const locale of LIBRARY_LOCALES) {
          const content = imageContent(item, request(canvas, locale))!;
          const where = `${item.id} ${canvas.width}x${canvas.height} ${locale}`;
          expect(content.layers.length, where).toBeGreaterThanOrEqual(1);
          for (const layer of content.layers) expect(layerIssue(layer), `${where} ${layer.type}`).toBeNull();
          if (content.layers.length > 1) expect(new Set(content.layers.map((layer) => layer.groupId)).size, where).toBe(1);
          for (const layer of content.layers) {
            expect(layer.transform.x, where).toBeGreaterThan(0);
            expect(layer.transform.x, where).toBeLessThan(1);
            expect(layer.transform.y, where).toBeGreaterThan(0);
            expect(layer.transform.y, where).toBeLessThan(1);
          }
        }
      }
    }
  });

  it("inserts as linked overlay clips in the video editor", () => {
    for (const item of ITEMS) {
      const clips = videoClips(item, { ...request(VIDEO_ASPECT_SIZES.landscape, "en"), atMs: 1000, documentMs: 10_000 })!;
      const layers = imageContent(item, request(VIDEO_ASPECT_SIZES.landscape, "en"))!.layers;
      expect(clips.length, item.id).toBe(layers.length);
      if (clips.length > 1) expect(new Set(clips.map((clip) => clip.linkId)).size, item.id).toBe(1);
      expect(clips.every((clip) => clip.startMs === 1000 && clip.type === "overlay"), item.id).toBe(true);
    }
  });

  it("lists colors that Elo can swap for brand colors", () => {
    for (const item of ITEMS) expect(layerColors(imageContent(item, request(VIDEO_ASPECT_SIZES.square, "pt"))!.layers).length, item.id).toBeGreaterThan(0);
  });

  it("takes Elo's words through add_element and still fits them", () => {
    const items = new Map(ITEMS.map((item) => [item.id, item]));
    const plan = elementPlan({ item_id: "text-combo-sale-50", texts: [{ slot: "title", text: "70% OFF" }, { slot: "subtitle", text: "só neste fim de semana" }] }, "image", { items, text: (label) => labelText(label, (key) => key, "pt"), locale: "pt" });
    if (!plan.ok) throw new Error(plan.reason);
    const content = imageContent(plan.item, { canvas: VIDEO_ASPECT_SIZES.square, locale: plan.locale, text: plan.text })!;
    const texts = content.layers.filter((layer): layer is Layer => layer.type === "text").map((layer) => layer.text);
    expect(texts).toEqual(["70% OFF", "só neste fim de semana"]);
  });
});
