import { counterLocaleFor, counterPresetClip } from "../../counter";
import { newTextLayer, TEXT_PRESETS, type TextPreset } from "../../document";
import { TEXT_STYLE_PRESETS, textPresetClips, type TextStylePreset } from "../../text-presets";
import { OWN_SOURCE, type LibraryCategory, type LibraryItem, type LibrarySlot } from "../model";

const TEXT_WIDTH = 0.8;
const LINE_ROOM = 1.6;

interface TextBlock {
  preset: TextPreset;
  id: string;
  box: number;
  size: number;
  category?: string;
  name?: string;
}

const TEXT_BLOCKS: TextBlock[] = [
  { preset: "heading", id: "text-heading", box: 0.14, size: 18 },
  { preset: "subheading", id: "text-subheading", box: 0.1, size: 15 },
  { preset: "body", id: "text-body", box: 0.08, size: 12 },
];

const TEXT_BOX: TextBlock = { preset: "body", id: "text-box", box: 0.08, size: 12, category: "textBox", name: "textBox" };

const STYLE_BOXES: Record<TextStylePreset, { id: string; w: number; h: number }> = {
  headline: { id: "text-style-headline", w: 0.86, h: 0.18 },
  caption: { id: "text-style-caption", w: 0.9, h: 0.14 },
  cta: { id: "text-style-cta", w: 0.62, h: 0.075 },
  lowerThird: { id: "text-style-lower-third", w: 0.66, h: 0.09 },
  tag: { id: "text-style-tag", w: 0.42, h: 0.06 },
};

const COUNTER_BOX = { w: 0.86, h: 0.16 };

function slot(sample: string): LibrarySlot {
  return { id: "text", sample: { key: `studio.library.samples.${sample}` } };
}

function textBlock({ preset, id, box, size, category = "text", name = preset }: TextBlock): LibraryItem {
  const height = Math.max(box, TEXT_PRESETS[preset].fontSize * LINE_ROOM);
  const sample = slot(name);
  return {
    id,
    category,
    editors: ["image", "video"],
    ratio: TEXT_WIDTH / height,
    label: { key: `studio.library.items.${name}` },
    preview: { kind: "text", size, weight: TEXT_PRESETS[preset].fontWeight },
    source: OWN_SOURCE,
    template: {
      kind: "layers",
      slots: [sample],
      build: (ctx) => ({ layers: [{ ...newTextLayer(ctx.text(sample), preset, { x: 0.5, y: 0.5, w: TEXT_WIDTH, h: height, rotation: 0, opacity: 1 }), fill: ctx.ink }] }),
    },
  };
}

const COUNTER: LibraryItem = {
  id: "text-counter",
  category: "text",
  editors: ["video"],
  ratio: COUNTER_BOX.w / COUNTER_BOX.h,
  label: { key: "studio.library.items.counter" },
  hint: { key: "studio.library.hints.counter" },
  preview: { kind: "text", size: 15, weight: 800 },
  source: OWN_SOURCE,
  template: { kind: "clips", build: (ctx) => [counterPresetClip(counterLocaleFor(ctx.locale), ctx.atMs)] },
};

function textStyle(preset: TextStylePreset): LibraryItem {
  const { id, w, h } = STYLE_BOXES[preset];
  const sample = slot(preset);
  return {
    id,
    category: "textStyles",
    editors: ["video"],
    ratio: w / h,
    label: { key: `studio.library.items.${preset}` },
    preview: { kind: "text", size: 12, weight: 600 },
    source: OWN_SOURCE,
    template: { kind: "clips", slots: [sample], build: (ctx) => textPresetClips(preset, ctx.text(sample), ctx.atMs) },
  };
}

const TEXT_ITEMS: readonly LibraryItem[] = [...TEXT_BLOCKS.map(textBlock), COUNTER];

const STYLE_ITEMS: readonly LibraryItem[] = TEXT_STYLE_PRESETS.map(textStyle);

const TEXT_BOX_ITEMS: readonly LibraryItem[] = [textBlock(TEXT_BOX)];

export const TEXT_BOX_CATEGORY: LibraryCategory = {
  id: "textBox",
  panel: "text",
  label: { key: "studio.library.categories.textBox" },
  tile: "action",
  items: () => TEXT_BOX_ITEMS,
};

export const TEXT_CATEGORY: LibraryCategory = {
  id: "text",
  panel: "text",
  label: { key: "studio.library.categories.text" },
  tile: "row",
  items: () => TEXT_ITEMS,
};

export const TEXT_STYLES_CATEGORY: LibraryCategory = {
  id: "textStyles",
  panel: "text",
  label: { key: "studio.library.categories.textStyles" },
  tile: "card",
  items: () => STYLE_ITEMS,
};
