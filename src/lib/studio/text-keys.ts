import type { Clip } from "./document";
import { TEXT_KEY_PROPERTIES, type TextKeyProperty } from "./text-properties";
import type { ClipPatch } from "./timeline";

type TextKeyed = Partial<Pick<Clip, "counter" | "textPath" | "keyframes">>;

function owns(clip: TextKeyed, property: TextKeyProperty): boolean {
  return property === "counter" ? clip.counter !== undefined : clip.textPath !== undefined;
}

export function textLaneProperties(clip: TextKeyed): TextKeyProperty[] {
  return TEXT_KEY_PROPERTIES.filter((property) => owns(clip, property) || (clip.keyframes?.[property]?.length ?? 0) > 0);
}

export function textStaticValue(clip: TextKeyed, property: TextKeyProperty): number {
  return property === "counter" ? (clip.counter?.value ?? 0) : (clip.textPath?.offset ?? 0);
}

export function textStaticPatch(clip: TextKeyed, property: TextKeyProperty, value: number): ClipPatch {
  if (property === "counter") return clip.counter ? { counter: { ...clip.counter, value } } : {};
  return clip.textPath ? { textPath: { ...clip.textPath, offset: value } } : {};
}
