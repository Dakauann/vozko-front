import type { Clip, Layer } from "./document";
import { valueAt, withoutProperty, type Keyframe } from "./keyframes";
import { curvePath } from "./paint";
import { mapSubpaths, pathToSubpaths, subpathsToPath } from "./path-nodes";
import { animatesText } from "./text-animation";
import { PATH_OFFSET_RANGE } from "./text-properties";
import type { ClipPatch } from "./timeline";
import type { IssueCode } from "./validate";
import { isValidPath, scalePath } from "./vector-path";

export const TEXT_PATH_SHAPES = ["arc", "circle", "wave", "custom"] as const;

export type TextPathShape = (typeof TEXT_PATH_SHAPES)[number];

export const TEXT_PATH_ALIGNS = ["start", "center", "end"] as const;

export type TextPathAlign = (typeof TEXT_PATH_ALIGNS)[number];

export const TEXT_PATH_BEND_RANGE = [-1, 1] as const;

const DEFAULT_TEXT_PATH_BEND = 0.5;

const DEFAULT_CUSTOM_TEXT_PATH = "M0 0.75 C0.3 0.15 0.7 0.15 1 0.75";

export interface TextPath {
  shape: TextPathShape;
  bend?: number;
  path?: string;
  offset: number;
  align: TextPathAlign;
  upright?: boolean;
  reverse?: boolean;
}

interface BoxSize {
  width: number;
  height: number;
}

const UNIT_BOX: BoxSize = { width: 1, height: 1 };

export function isTextPathShape(value: string): value is TextPathShape {
  return (TEXT_PATH_SHAPES as readonly string[]).includes(value);
}

export function isTextPathAlign(value: string): value is TextPathAlign {
  return (TEXT_PATH_ALIGNS as readonly string[]).includes(value);
}

export function usesBend(shape: TextPathShape): boolean {
  return shape === "arc" || shape === "wave";
}

export function newTextPath(shape: TextPathShape, layer?: Pick<Layer, "curve">): TextPath {
  const curve = layer?.curve ?? 0;
  const bend = curve !== 0 ? curve : DEFAULT_TEXT_PATH_BEND;
  return { shape, ...(usesBend(shape) ? { bend } : {}), ...(shape === "custom" ? { path: DEFAULT_CUSTOM_TEXT_PATH } : {}), offset: 0.5, align: "center" };
}

function circleData(width: number, height: number): string {
  const rx = width / 2;
  const ry = height / 2;
  const arc = (x: number, y: number) => `A ${rx} ${ry} 0 0 1 ${x} ${y}`;
  return `M ${rx} ${height} ${arc(0, ry)} ${arc(rx, 0)} ${arc(width, ry)} ${arc(rx, height)} Z`;
}

function waveData(width: number, height: number, bend: number): string {
  const middle = height / 2;
  const reach = bend * height;
  return `M 0 ${middle} Q ${width / 4} ${middle - reach} ${width / 2} ${middle} Q ${(3 * width) / 4} ${middle + reach} ${width} ${middle}`;
}

export function textPathData(path: TextPath, width: number, height: number): string {
  switch (path.shape) {
    case "arc":
      return curvePath(width, height, path.bend ?? 0);
    case "circle":
      return circleData(width, height);
    case "wave":
      return waveData(width, height, path.bend ?? 0);
    case "custom":
      return scalePath(path.path ?? "", width, height);
  }
}

function presetFractions(path: TextPath, box: BoxSize): string {
  const width = box.width > 0 ? box.width : UNIT_BOX.width;
  const height = box.height > 0 ? box.height : UNIT_BOX.height;
  return subpathsToPath(mapSubpaths(pathToSubpaths(textPathData(path, width, height)), (point) => ({ x: point.x / width, y: point.y / height })));
}

export function reshapedTextPath(current: TextPath, shape: TextPathShape, box: BoxSize): TextPath {
  const kept = { offset: current.offset, align: current.align, ...(current.upright ? { upright: true } : {}), ...(current.reverse ? { reverse: true } : {}) };
  if (shape === "custom") return { shape, path: current.shape === "custom" ? (current.path ?? DEFAULT_CUSTOM_TEXT_PATH) : presetFractions(current, box), ...kept };
  return { shape, ...(usesBend(shape) ? { bend: current.bend ?? DEFAULT_TEXT_PATH_BEND } : {}), ...kept };
}

function offsetFrames(clip: Pick<Clip, "keyframes">): readonly Keyframe[] {
  return clip.keyframes?.pathOffset ?? [];
}

export function pathOffsetAt(clip: Pick<Clip, "textPath" | "keyframes">, localMs: number): number {
  const frames = offsetFrames(clip);
  const value = frames.length > 0 ? valueAt(frames, localMs) : (clip.textPath?.offset ?? 0);
  return Math.min(PATH_OFFSET_RANGE[1], Math.max(PATH_OFFSET_RANGE[0], value));
}

export function textPathPatch(clip: Pick<Clip, "keyframes" | "layer">, path: TextPath | null): ClipPatch {
  if (!path) return { textPath: undefined, keyframes: withoutProperty(clip.keyframes, "pathOffset") };
  if (!clip.layer || (clip.layer.curve ?? 0) === 0) return { textPath: path };
  const layer = { ...clip.layer };
  delete layer.curve;
  return { textPath: path, layer };
}

function within(value: number, [low, high]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= low && value <= high;
}

function shapeIssue(path: TextPath): IssueCode | null {
  if (usesBend(path.shape) !== (path.bend !== undefined)) return "invalid";
  if (path.bend !== undefined && !within(path.bend, TEXT_PATH_BEND_RANGE)) return "out_of_range";
  const traced = (path.path ?? "") !== "";
  if ((path.shape === "custom") !== traced) return "invalid";
  return traced && !isValidPath(path.path!) ? "invalid" : null;
}

export function textPathIssue(clip: Clip): IssueCode | null {
  const path = clip.textPath;
  if (!path) return offsetFrames(clip).length > 0 ? "invalid" : null;
  if (!animatesText(clip) || (clip.layer?.curve ?? 0) !== 0) return "invalid";
  if (!isTextPathShape(path.shape) || !isTextPathAlign(path.align)) return "unknown";
  if (!within(path.offset, PATH_OFFSET_RANGE)) return "out_of_range";
  return shapeIssue(path);
}
