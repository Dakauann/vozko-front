import { isNeutralLut, type GradeLut } from "./cube-lut";
import type { Clip, ImageSurface, Layer, VideoDocument } from "./document";
import { isGroupClip } from "./group-scope";
import { visibleLayers } from "./image-edits";
import { repeatedLayers } from "./repeat-edits";
import { clipEnd } from "./timeline";
import type { TimeSpan } from "./work-area";

export type LutOwner = { kind: "clip"; clip: Clip } | { kind: "layer"; layer: Layer };

export interface LutUse {
  assetId: string;
  owner: LutOwner;
}

export type LutReadable = (assetId: string) => Promise<boolean>;

function appliedLut(lut: GradeLut | undefined): string | null {
  return lut && !isNeutralLut(lut) ? lut.assetId : null;
}

function overlaps(clip: Clip, span: TimeSpan | undefined): boolean {
  return !span || (clip.startMs < span.endMs && clipEnd(clip) > span.startMs);
}

function clipUses(clip: Clip): LutUse[] {
  const own = appliedLut(clip.color?.lut) ?? appliedLut(clip.layer?.color?.lut);
  const inner = isGroupClip(clip) ? clip.tracks.flatMap((track) => (track.kind === "visual" && !track.hidden ? track.clips.flatMap((child) => (child.disabled ? [] : clipUses(child))) : [])) : [];
  return [...(own ? [{ assetId: own, owner: { kind: "clip" as const, clip } }] : []), ...inner];
}

export function videoLutUses(doc: Pick<VideoDocument, "tracks">, span?: TimeSpan): LutUse[] {
  return doc.tracks.flatMap((track) => (track.kind === "visual" && !track.hidden ? track.clips.flatMap((clip) => (!clip.disabled && overlaps(clip, span) ? clipUses(clip) : [])) : []));
}

export function surfaceLutUses(surface: ImageSurface): LutUse[] {
  return visibleLayers(repeatedLayers(surface)).flatMap((layer) => {
    const assetId = layer.type === "image" ? appliedLut(layer.color?.lut) : null;
    return assetId ? [{ assetId, owner: { kind: "layer" as const, layer } }] : [];
  });
}

export async function firstUnreadableLut(uses: readonly LutUse[], readable: LutReadable): Promise<LutUse | null> {
  const ids = [...new Set(uses.map((use) => use.assetId))];
  const results = await Promise.all(ids.map((id) => readable(id)));
  const missing = new Set(ids.filter((_, i) => !results[i]));
  return uses.find((use) => missing.has(use.assetId)) ?? null;
}

export function lutSpanOf(times: readonly number[]): TimeSpan {
  return { startMs: Math.min(...times), endMs: Math.max(...times) + 1 };
}
