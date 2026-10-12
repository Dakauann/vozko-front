import type { Clip } from "./document";
import type { Easing } from "./keyframes";
import type { IssueCode } from "./validate";
import { isValidPath, MAX_PATH_COORDINATE } from "./vector-path";

export const MORPH_PROPERTY = "path" as const;

export type MorphProperty = typeof MORPH_PROPERTY;

export interface VertexPin {
  x: number;
  y: number;
}

export interface MorphKeyframe {
  atMs: number;
  path: string;
  easing: Easing;
  firstVertex?: VertexPin;
}

export type MorphFault = "path" | "vertex";

export function isMorphProperty(property: string): property is MorphProperty {
  return property === MORPH_PROPERTY;
}

function pinFits(pin: VertexPin): boolean {
  return [pin.x, pin.y].every((value) => Number.isFinite(value) && Math.abs(value) <= MAX_PATH_COORDINATE);
}

export function morphKeyFault(key: MorphKeyframe): MorphFault | null {
  if (typeof key.path !== "string" || !isValidPath(key.path)) return "path";
  return key.firstVertex && !pinFits(key.firstVertex) ? "vertex" : null;
}

export function clipMorphIssue(clip: Pick<Clip, "type" | "layer" | "keyframes">): IssueCode | null {
  if ((clip.keyframes?.path?.length ?? 0) === 0) return null;
  return clip.type === "overlay" && clip.layer?.type === "shape" && clip.layer.shape === "path" ? null : "invalid";
}
