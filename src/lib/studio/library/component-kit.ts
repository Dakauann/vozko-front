import type { ChartKind, ChartSpec } from "../chart";
import { newChartLayer } from "../chart-edits";
import type { Layer, TextAlign } from "../document";
import type { LibraryContext, LibrarySlot } from "./model";
import { colorOf, frameOf, placeTextIn, surfaceLayer, textLayer, textSlots, transformOf, type Box, type ComboColor, type ComboSurface, type ComboText, type Frame } from "./text-combo";

export interface ComponentPanel {
  kind: "panel";
  box: Box;
  surface: ComboSurface;
}

export interface ComponentText {
  kind: "text";
  left: number;
  top: number;
  width: number;
  align: TextAlign;
  part: ComboText;
}

export interface ComponentChart {
  kind: "chart";
  box: Box;
  chart: ChartKind;
  ink: ComboColor;
}

export type ComponentPart = ComponentPanel | ComponentText | ComponentChart;

export interface ComponentKit {
  width: number;
  height: number;
  parts: readonly ComponentPart[];
}

export type ChartSampler = (kind: ChartKind, locale: string, ink: string) => ChartSpec;

function textParts(kit: ComponentKit): ComboText[] {
  return kit.parts.flatMap((part) => (part.kind === "text" ? [part.part] : []));
}

export function componentSlots(kit: ComponentKit): LibrarySlot[] {
  return textSlots(textParts(kit));
}

export function componentRatio(kit: ComponentKit): number {
  return kit.width / kit.height;
}

function partLayer(part: ComponentPart, frame: Frame, ctx: LibraryContext, slots: ReadonlyMap<string, LibrarySlot>, sample: ChartSampler): Layer {
  switch (part.kind) {
    case "panel":
      return surfaceLayer(part.surface, part.box, frame, ctx.ink);
    case "chart":
      return newChartLayer(sample(part.chart, ctx.locale, colorOf(part.ink, ctx.ink)), transformOf(part.box, frame));
    case "text": {
      const span = { left: part.left, top: part.top, width: part.width, room: part.width };
      return textLayer(placeTextIn(part.part, ctx.text(slots.get(part.part.slot)!), span, part.align), frame, part.align, ctx.ink);
    }
  }
}

export function componentLayers(kit: ComponentKit, ctx: LibraryContext, sample: ChartSampler): Layer[] {
  const slots = new Map(componentSlots(kit).map((slot) => [slot.id, slot]));
  const frame = frameOf({ x: kit.width / 2, y: kit.height / 2, w: kit.width, h: kit.height }, ctx.canvas, 0);
  return kit.parts.map((part) => partLayer(part, frame, ctx, slots, sample));
}
