import { emptyVideoDocument, msOfFrame, frameOf, type Clip, type Layer, type VideoAspect } from "../document";
import { clampTo, LAYER_RANGES } from "../layer-ranges";
import { scaledUnits } from "../layers";
import type { LineState } from "../line-animation";
import { visualPlan, type VisualItem } from "../playback";

const UNIFORM = 1e-4;
const FULL = 1e-4;

export function lastFrameMs(durationMs: number): number {
  return msOfFrame(Math.max(0, frameOf(durationMs) - 1));
}

function fullLine(line: LineState | undefined): boolean {
  if (!line) return true;
  const { trim, wave, wiggle, taper } = line.resolved;
  return !wave && !wiggle && !taper && (!trim || (trim.start <= FULL && trim.end >= 1 - FULL));
}

function still(item: VisualItem): Layer | null {
  const layer = item.layer;
  if (!layer || item.type !== "overlay" || item.paint || item.tint || item.reveal || item.blurPx > 0 || item.flipX || item.flipY || !fullLine(item.line)) return null;
  const sx = item.base.w > 0 ? item.transform.w / item.base.w : 1;
  const sy = item.base.h > 0 ? item.transform.h / item.base.h : 1;
  if (Math.abs(sx - sy) > UNIFORM * Math.max(sx, sy)) return null;
  const units = Math.abs(sx - 1) > UNIFORM ? scaledUnits(layer, sx) : {};
  const font = layer.fontSize !== undefined && Math.abs(sx - 1) > UNIFORM ? { fontSize: clampTo(layer.fontSize * sx, LAYER_RANGES.fontSize) } : {};
  return { ...layer, ...units, ...font, transform: { ...item.transform, opacity: item.opacity } };
}

export function stickerStill(clips: readonly Clip[], aspect: VideoAspect, atMs: number): Layer[] | null {
  const doc = emptyVideoDocument(aspect);
  const span = Math.max(...clips.map((clip) => clip.startMs + clip.durationMs), 0);
  const film = { ...doc, durationMs: Math.max(doc.durationMs, span), tracks: clips.map((clip, index) => ({ id: `still-${index}`, kind: "visual" as const, clips: [clip] })) };
  const items = new Map(visualPlan(film, atMs, 0).map((item) => [item.clipId, item]));
  const layers: Layer[] = [];
  for (const clip of clips) {
    const item = items.get(clip.id);
    if (!item?.active) return null;
    const layer = still(item);
    if (!layer) return null;
    if (layer.transform.opacity > 0) layers.push(layer);
  }
  return layers;
}
