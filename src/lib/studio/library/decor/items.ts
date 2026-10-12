import type { CanvasSize } from "../../document";
import { artLayers, type SvgTarget } from "../../svg-import";
import { OWN_SOURCE, type LibraryItem, type LibraryPreview } from "../model";
import { PREVIEW_INK } from "../preview";
import { artItems } from "../sets/art-set";
import { centeredTarget, emojiArt, emojiMarkup } from "../sets/format";
import { DECOR_SPECS, type DecorSpec } from "./packs";

export const DECOR_SHARE = 0.4;

const PREVIEW_CANVAS: CanvasSize = { width: 400, height: 400 };

function targetOf(spec: DecorSpec, canvas: CanvasSize): SvgTarget {
  if (spec.fills === "canvas") return { center: { x: canvas.width / 2, y: canvas.height / 2 }, width: canvas.width, height: canvas.height, rotation: 0 };
  return centeredTarget(canvas, spec.share ?? DECOR_SHARE, spec.ratio);
}

export function decorPreview(spec: DecorSpec): LibraryPreview {
  return { kind: "svg", markup: emojiMarkup(spec.draw({ ink: PREVIEW_INK, canvas: PREVIEW_CANVAS })) };
}

function decorItem(spec: DecorSpec): LibraryItem {
  return {
    id: spec.id,
    category: "graphics",
    subcategory: spec.subcategory,
    editors: ["image", "video"],
    ratio: spec.ratio,
    label: { text: spec.name },
    ...(spec.tags ? { tags: spec.tags } : {}),
    preview: { kind: "deferred", load: async () => decorPreview(spec) },
    source: OWN_SOURCE,
    template: { kind: "layers", build: (ctx) => artLayers(emojiArt(spec.draw({ ink: ctx.ink, canvas: ctx.canvas })), ctx.canvas, { target: targetOf(spec, ctx.canvas) }) },
  };
}

export function decorItems(): LibraryItem[] {
  return DECOR_SPECS.map(decorItem);
}

export async function graphicsItems(): Promise<LibraryItem[]> {
  return [...decorItems(), ...(await artItems())];
}
