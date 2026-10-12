import { BLEND_MODES, type BlendMode, type Clip } from "./document";
import type { ClipPatch } from "./timeline";
import type { IssueCode } from "./validate";

export function isBlendMode(value: unknown): value is BlendMode {
  return (BLEND_MODES as readonly unknown[]).includes(value);
}

export function blendsAsMedia(clip: Pick<Clip, "type">): boolean {
  return clip.type === "video" || clip.type === "image" || clip.type === "group";
}

export function blendsClip(clip: Pick<Clip, "type" | "layer">): boolean {
  return blendsAsMedia(clip) || (clip.type === "overlay" && Boolean(clip.layer));
}

export function clipBlend(clip: Pick<Clip, "type" | "layer" | "blendMode">): BlendMode {
  if (clip.type === "overlay") return clip.layer?.blendMode ?? "normal";
  return blendsAsMedia(clip) ? (clip.blendMode ?? "normal") : "normal";
}

export function clipBlendPatch(clip: Pick<Clip, "type" | "layer">, mode: BlendMode): ClipPatch | null {
  const stored = mode === "normal" ? undefined : mode;
  if (blendsAsMedia(clip)) return { blendMode: stored };
  if (clip.type === "overlay" && clip.layer) return { layer: { ...clip.layer, blendMode: stored } };
  return null;
}

export function clipBlendIssue(clip: Pick<Clip, "type" | "blendMode">): IssueCode | null {
  if ((clip.blendMode ?? "") === "") return null;
  if (!isBlendMode(clip.blendMode)) return "unknown";
  return blendsAsMedia(clip) ? null : "invalid";
}
