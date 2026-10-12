import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

import { elementPlan } from "../../agent/element-ops";
import { CHART_KINDS } from "../../chart";
import { VIDEO_ASPECT_SIZES, type CanvasSize, type Layer } from "../../document";
import { layerIssue } from "../../validate";
import { labelText } from "../catalog";
import { translatorOf } from "../catalog-file";
import { imageContent, videoClips, type LibraryRequest } from "../instantiate";
import { LIBRARY_LOCALES, type LibraryItem, type LibraryLocale, type LibrarySlot } from "../model";
import { layerColors } from "../placement";
import { PREVIEW_INK } from "../preview";
import { COMPONENT_SUBCATEGORIES, COMPONENTS_CATEGORY } from "./components";

const ITEMS = COMPONENTS_CATEGORY.items() as readonly LibraryItem[];
const CANVASES: CanvasSize[] = [VIDEO_ASPECT_SIZES.square, VIDEO_ASPECT_SIZES.story, VIDEO_ASPECT_SIZES.landscape];
const DASHES = new RegExp(`[${String.fromCodePoint(0x2012)}-${String.fromCodePoint(0x2015)}]`, "u");
const SQUARE = VIDEO_ASPECT_SIZES.square;
const translate = translatorOf({ pt, en, es, de });

function sampleIn(locale: LibraryLocale) {
  return (slot: LibrarySlot) => labelText(slot.sample, (key) => translate(locale, key), locale);
}

function request(canvas: CanvasSize, locale: LibraryLocale, extra: Partial<LibraryRequest> = {}): LibraryRequest {
  return { canvas, locale, text: sampleIn(locale), ...extra };
}

function lookup() {
  return { items: new Map(ITEMS.map((item) => [item.id, item])), text: (label: LibraryItem["label"]) => labelText(label, (key) => translate("pt", key), "pt"), locale: "pt" };
}

function texts(layers: readonly Layer[]): string[] {
  return layers.filter((layer) => layer.type === "text").map((layer) => layer.text ?? "");
}

describe("the component library", () => {
  it("ships KPI cards, chart cards, navigation, glass panels and price or listing cards", () => {
    expect(COMPONENT_SUBCATEGORIES).toEqual(["kpis", "charts", "navigation", "glass", "pricing"]);
    for (const sub of COMPONENT_SUBCATEGORIES) expect(ITEMS.filter((item) => item.subcategory === sub).length, sub).toBeGreaterThanOrEqual(2);
    expect(new Set(ITEMS.map((item) => item.id)).size).toBe(ITEMS.length);
    for (const item of ITEMS) expect(item.id, item.id).toMatch(/^component-/);
  });

  it("names every component and sample in the four languages without dashes", () => {
    for (const item of ITEMS) {
      for (const locale of LIBRARY_LOCALES) {
        const name = labelText(item.label, (key) => translate(locale, key), locale);
        expect(name.trim(), item.id).not.toBe("");
        expect(name, item.id).not.toMatch(DASHES);
        for (const slot of item.template.slots ?? []) {
          const sample = sampleIn(locale)(slot);
          expect(sample.trim(), `${item.id} ${slot.id}`).not.toBe("");
          expect(sample, `${item.id} ${slot.id}`).not.toMatch(DASHES);
        }
      }
    }
    for (const locale of LIBRARY_LOCALES) {
      expect(() => labelText(COMPONENTS_CATEGORY.label, (key) => translate(locale, key), locale)).not.toThrow();
      for (const sub of COMPONENTS_CATEGORY.subcategories ?? []) expect(() => labelText(sub.label, (key) => translate(locale, key), locale), sub.id).not.toThrow();
    }
  });

  it("draws each preview as a standalone SVG painted in the preview ink", () => {
    for (const item of ITEMS) {
      expect(item.preview.kind, item.id).toBe("svg");
      const markup = item.preview.kind === "svg" ? item.preview.markup : "";
      expect(markup, item.id).toContain(`fill="${PREVIEW_INK}"`);
      expect(markup, item.id).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    }
  });

  it("gives every text a distinct slot so add_element can rewrite it", () => {
    for (const item of ITEMS) {
      const slots = item.template.slots ?? [];
      expect(slots.length, item.id).toBeGreaterThanOrEqual(2);
      expect(new Set(slots.map((slot) => slot.id)).size, item.id).toBe(slots.length);
      expect(texts(imageContent(item, request(SQUARE, "pt"))!.layers).length, item.id).toBe(slots.length);
    }
  });

  it("inserts as one editable group of valid layers on every canvas and in every language", () => {
    for (const item of ITEMS) {
      for (const canvas of CANVASES) {
        for (const locale of LIBRARY_LOCALES) {
          const content = imageContent(item, request(canvas, locale))!;
          const where = `${item.id} ${canvas.width}x${canvas.height} ${locale}`;
          expect(content.layers.length, where).toBeGreaterThan(2);
          for (const layer of content.layers) expect(layerIssue(layer), `${where} ${layer.type}`).toBeNull();
          expect(new Set(content.layers.map((layer) => layer.groupId)).size, where).toBe(1);
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
      expect(item.editors, item.id).toEqual(["image", "video"]);
      const clips = videoClips(item, { ...request(VIDEO_ASPECT_SIZES.landscape, "en"), atMs: 500, documentMs: 10_000 })!;
      expect(clips.length, item.id).toBe(imageContent(item, request(VIDEO_ASPECT_SIZES.landscape, "en"))!.layers.length);
      expect(new Set(clips.map((clip) => clip.linkId)).size, item.id).toBe(1);
      expect(clips.every((clip) => clip.startMs === 500 && clip.type === "overlay"), item.id).toBe(true);
    }
  });

  it("puts a real chart layer from the chart machinery inside every chart card, labelled in the inserted language", () => {
    for (const item of ITEMS.filter((entry) => entry.subcategory === "charts")) {
      const charts = imageContent(item, request(SQUARE, "de"))!.layers.filter((layer) => layer.type === "chart");
      expect(charts.length, item.id).toBe(1);
      expect(CHART_KINDS, item.id).toContain(charts[0].chart!.kind);
      expect(charts[0].chart!.data.labels, item.id).toContain("Mär");
    }
  });

  it("takes Elo's words for every slot through add_element texts", () => {
    for (const item of ITEMS) {
      const slots = item.template.slots ?? [];
      const wanted = slots.map((slot, i) => ({ slot: slot.id, text: `Novo ${i + 1}` }));
      const plan = elementPlan({ item_id: item.id, texts: wanted }, "image", lookup());
      if (!plan.ok) throw new Error(plan.reason);
      const content = imageContent(plan.item, { canvas: SQUARE, locale: plan.locale, text: plan.text })!;
      expect(texts(content.layers).sort(), item.id).toEqual(wanted.map((entry) => entry.text).sort());
    }
  });

  it("swaps each listed color for a brand color through add_element colors", () => {
    for (const item of ITEMS) {
      const colors = layerColors(imageContent(item, request(SQUARE, "pt"))!.layers);
      expect(colors.length, item.id).toBeGreaterThanOrEqual(2);
      const from = colors[0];
      const plan = elementPlan({ item_id: item.id, colors: [{ from, to: "#ff00aa" }] }, "image", lookup());
      if (!plan.ok) throw new Error(plan.reason);
      const swapped = layerColors(imageContent(plan.item, { canvas: SQUARE, locale: plan.locale, text: plan.text, colors: plan.colors })!.layers);
      expect(swapped, item.id).toContain("#ff00aa");
      expect(swapped, item.id).not.toContain(from);
    }
  });

  it("shrinks a long value to stay inside its card", () => {
    const card = ITEMS.find((item) => item.id === "component-kpi-card")!;
    const plain = imageContent(card, request(SQUARE, "pt"))!.layers;
    const long = imageContent(card, request(SQUARE, "pt", { text: (slot) => (slot.id === "value" ? "R$ 1.234.567.890,00" : sampleIn("pt")(slot)) }))!.layers;
    const sizeOf = (layers: readonly Layer[], text: string) => layers.find((layer) => layer.text === text)!.fontSize!;
    expect(sizeOf(long, "R$ 1.234.567.890,00")).toBeLessThan(sizeOf(plain, sampleIn("pt")(card.template.slots!.find((slot) => slot.id === "value")!)));
    const panel = long[0];
    for (const layer of long) expect(layer.transform.w, layer.text).toBeLessThanOrEqual(panel.transform.w + 1e-9);
  });
});
