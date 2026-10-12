import { captureArtboard } from "@/components/studio/agent/frame-capture";
import type { TextMeasure } from "@/lib/studio/agent/text-ink";
import { depthReport } from "@/lib/studio/agent/depth-report";
import { layoutReport } from "@/lib/studio/agent/layout-report";
import { outlineLayer, type OutlineContext } from "@/lib/studio/agent/outline";
import { findingLines } from "@/lib/studio/agent/perception";
import type { ImageSurface } from "@/lib/studio/document";

import { asciiMap } from "./ascii-map";

const OUTLINE: OutlineContext = { detail: "full", asset: () => undefined, playheadMs: 0, selection: [], jobs: [] };

export async function channelOutputs(surface: ImageSurface, measure: TextMeasure): Promise<Record<string, unknown>> {
  const depth = depthReport(surface);
  const layout = layoutReport(surface, measure);
  const overlay = await captureArtboard(surface, { view: "render", targets: [], numbered: false, shapes: [...depth.shapes, ...layout.shapes] }, null);
  return {
    outline: { width: surface.canvas.width, height: surface.canvas.height, background: surface.canvas.background, layers: surface.layers.map((layer, z) => outlineLayer(layer, z, OUTLINE)) },
    depth: { light: depth.light, shadows: depth.shadows, covered: depth.covered, findings: findingLines(depth.findings) },
    layout: { margins: layout.margins, levels: layout.levels, reading: layout.reading, balance: layout.balance, findings: findingLines(layout.findings) },
    ascii: asciiMap(surface),
    structured: { depth: depth.findings, layout: layout.findings },
    images: { overlay },
  };
}
