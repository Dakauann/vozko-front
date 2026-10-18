import type { Clip, ImageSurface, Layer } from "./document";
import { fillTargetOf } from "./frame-fill";
import type { LayerPatch } from "./layers";
import type { Pattern } from "./pattern";

export type AssetSlot = "asset" | "pattern" | number;

export interface ImageSource {
  layerId: string;
  slot: AssetSlot;
  assetId: string | null;
  framed: boolean;
}

function assetOfPattern(pattern: Pattern | undefined): string | null {
  return pattern?.source === "asset" && pattern.assetId ? pattern.assetId : null;
}

export function slotAsset(layer: Layer, slot: AssetSlot): string | null {
  if (slot === "asset") return layer.assetId ?? null;
  if (slot === "pattern") return assetOfPattern(layer.pattern);
  const paint = layer.fills?.[slot];
  return paint?.type === "pattern" ? assetOfPattern(paint.pattern) : null;
}

export function withSlotAsset(layer: Layer, slot: AssetSlot, assetId: string): LayerPatch {
  if (slot === "asset") return { assetId };
  if (slot === "pattern") return layer.pattern ? { pattern: { ...layer.pattern, assetId } } : {};
  const fills = layer.fills ?? [];
  if (!fills[slot]?.pattern) return {};
  return { fills: fills.map((paint, index) => (index === slot && paint.pattern ? { ...paint, pattern: { ...paint.pattern, assetId } } : paint)) };
}

function patternSources(layer: Layer): ImageSource[] {
  const own = assetOfPattern(layer.pattern);
  const painted = (layer.fills ?? []).flatMap((paint, index) => {
    const assetId = paint.type === "pattern" && !paint.hidden ? assetOfPattern(paint.pattern) : null;
    return assetId ? [{ layerId: layer.id, slot: index as AssetSlot, assetId, framed: false }] : [];
  });
  return [...(own ? [{ layerId: layer.id, slot: "pattern" as AssetSlot, assetId: own, framed: false }] : []), ...painted];
}

function sourcesOfLayer(surface: ImageSurface, layer: Layer): ImageSource[] {
  const fill = fillTargetOf(surface, layer.id);
  if (fill?.photoId) {
    const photo = surface.layers.find((candidate) => candidate.id === fill.photoId);
    return photo ? [{ layerId: photo.id, slot: "asset", assetId: photo.assetId ?? null, framed: true }] : [];
  }
  if (layer.type === "image") return [{ layerId: layer.id, slot: "asset", assetId: layer.assetId ?? null, framed: false }];
  return patternSources(layer);
}

type ClipSlot = "clip" | AssetSlot;

interface ClipImageSource {
  slot: ClipSlot;
  assetId: string | null;
}

export function clipImageSource(clip: Clip): ClipImageSource | null {
  if (clip.type === "image") return { slot: "clip", assetId: clip.assetId ?? null };
  if (clip.type !== "overlay" || !clip.layer) return null;
  if (clip.layer.type === "image") return { slot: "asset", assetId: clip.layer.assetId ?? null };
  const painted = patternSources(clip.layer);
  return painted.length === 1 ? { slot: painted[0].slot, assetId: painted[0].assetId } : null;
}

export function soleSource(sources: readonly ImageSource[]): ImageSource | null {
  return sources.length === 1 ? sources[0] : null;
}

export function clipSlotAsset(clip: Clip, slot: AssetSlot | undefined): string | null {
  if (slot === undefined) return clip.assetId ?? null;
  return clip.layer ? slotAsset(clip.layer, slot) : null;
}

export function imageSourcesOf(surface: ImageSurface, ids: readonly string[]): ImageSource[] {
  const wanted = new Set(ids);
  const seen = new Set<string>();
  return surface.layers
    .filter((layer) => wanted.has(layer.id))
    .flatMap((layer) => sourcesOfLayer(surface, layer))
    .filter((source) => {
      const key = `${source.layerId}:${source.slot}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
