import { committedPoints, smoothSegment, type Stride } from "./brush";
import { isEditableTarget, type KeyStroke } from "./keymap";
import { surfaceScale, toSurface, type PixelFrame } from "./pixel-space";
import { PIXEL_RANGES, type PixelMode, type StrokeOp } from "./pixel-surface";
import type { Point } from "./viewport";

export const PIXEL_TOOLS = ["brush", "eraser", "rect", "ellipse", "lasso"] as const;

export type PixelTool = (typeof PIXEL_TOOLS)[number];

export const PIXEL_TOOL_KEYS: Record<PixelTool, string> = { brush: "B", eraser: "E", rect: "M", ellipse: "Shift+M", lasso: "L" };

export interface BrushSettings {
  size: number;
  hardness: number;
  opacity: number;
  color: string;
  restore: boolean;
  pressure: boolean;
}

export const DEFAULT_BRUSH: BrushSettings = { size: 24, hardness: 0.8, opacity: 1, color: "#111111", restore: false, pressure: true };

const HARDNESS_STEP = 0.1;

export type PixelKeyAction =
  | { type: "tool"; tool: PixelTool | null }
  | { type: "size"; direction: 1 | -1 }
  | { type: "hardness"; direction: 1 | -1 }
  | { type: "opacity"; value: number }
  | { type: "swap" }
  | { type: "erase" }
  | { type: "deselect" }
  | { type: "invert" }
  | { type: "copy" };

interface PixelKeyContext {
  tool: PixelTool | null;
  hasSelection: boolean;
}

const TOOL_LETTERS: Record<string, PixelTool> = { b: "brush", e: "eraser", m: "rect", l: "lasso" };

export function isBrushTool(tool: PixelTool | null): tool is "brush" | "eraser" {
  return tool === "brush" || tool === "eraser";
}

function bracket(stroke: KeyStroke): 1 | -1 | null {
  if (stroke.code === "BracketRight" || stroke.key === "]" || stroke.key === "}") return 1;
  if (stroke.code === "BracketLeft" || stroke.key === "[" || stroke.key === "{") return -1;
  return null;
}

function digit(stroke: KeyStroke): number | null {
  const match = /^Digit(\d)$/.exec(stroke.code ?? "") ?? /^(\d)$/.exec(stroke.key);
  return match ? Number(match[1]) : null;
}

function modifiedAction(stroke: KeyStroke, context: PixelKeyContext): PixelKeyAction | null {
  if (!context.hasSelection || stroke.altKey) return null;
  const key = stroke.key.toLowerCase();
  if (key === "i" && stroke.shiftKey) return { type: "invert" };
  if (key === "j" && !stroke.shiftKey) return { type: "copy" };
  return null;
}

export function pixelKeyActionFor(stroke: KeyStroke, context: PixelKeyContext): PixelKeyAction | null {
  if (isEditableTarget(stroke.target)) return null;
  if (stroke.ctrlKey || stroke.metaKey) return modifiedAction(stroke, context);
  if (stroke.altKey) return null;
  if (stroke.key === "Escape") return context.hasSelection ? { type: "deselect" } : context.tool ? { type: "tool", tool: null } : null;
  if ((stroke.key === "Delete" || stroke.key === "Backspace") && !stroke.shiftKey) return context.hasSelection ? { type: "erase" } : null;
  const key = stroke.key.length === 1 ? stroke.key.toLowerCase() : stroke.key;
  if (key === "m" && stroke.shiftKey) return { type: "tool", tool: "ellipse" };
  if (!stroke.shiftKey && TOOL_LETTERS[key]) return { type: "tool", tool: TOOL_LETTERS[key] };
  if (!isBrushTool(context.tool)) return null;
  const side = bracket(stroke);
  if (side) return stroke.shiftKey ? { type: "hardness", direction: side } : { type: "size", direction: side };
  if (stroke.shiftKey) return null;
  if (key === "x") return { type: "swap" };
  const value = digit(stroke);
  return value === null ? null : { type: "opacity", value: value === 0 ? 1 : value / 10 };
}

function sizeStep(size: number): number {
  if (size < 10) return 1;
  if (size < 50) return 5;
  if (size < 100) return 10;
  if (size < 300) return 25;
  return 50;
}

export function nextBrushSize(size: number, direction: 1 | -1): number {
  const [low, high] = PIXEL_RANGES.size;
  const next = direction > 0 ? size + sizeStep(size) : size - sizeStep(Math.max(low, size - 1));
  return Math.min(high, Math.max(low, Math.round(next)));
}

export function nextHardness(hardness: number, direction: 1 | -1): number {
  return Math.min(1, Math.max(0, Math.round((hardness + direction * HARDNESS_STEP) * 10) / 10));
}

export function brushStroke(brush: BrushSettings, frame: PixelFrame, mode: PixelMode, id: string, pressure: boolean): StrokeOp {
  const [low, high] = PIXEL_RANGES.size;
  return {
    kind: "stroke",
    id,
    mode,
    ...(mode === "paint" ? { color: brush.color } : {}),
    size: Math.min(high, Math.max(low, Math.round(brush.size * surfaceScale(frame)))),
    hardness: brush.hardness,
    opacity: brush.opacity,
    ...(pressure ? { pressure: true } : {}),
    points: [],
  };
}

const SEGMENT_STEP_PX = 3;
const MAX_SEGMENT_STEPS = 16;

export class StrokeBuilder {
  private readonly raw: number[] = [];
  private readonly live: number[] = [];
  private appended = 0;
  private readonly stride: Stride;

  constructor(
    private readonly frame: PixelFrame,
    private readonly base: StrokeOp,
  ) {
    this.stride = base.pressure ? 3 : 2;
  }

  add(point: Point, pressure: number): StrokeOp {
    const at = toSurface(this.frame, point);
    this.raw.push(at.x, at.y, ...(this.stride === 3 ? [Math.min(1, Math.max(0, pressure))] : []));
    const count = this.raw.length / this.stride;
    if (count === 1) this.live.push(...this.raw);
    this.appendThrough(count - 3);
    return { ...this.base, points: [...this.live] };
  }

  finish(): StrokeOp {
    this.appendThrough(this.raw.length / this.stride - 2);
    return { ...this.base, points: committedPoints(this.live, this.stride, this.frame.surface) };
  }

  private appendThrough(last: number): void {
    for (; this.appended <= last; this.appended++) {
      const i = this.appended * this.stride;
      const length = Math.hypot(this.raw[i + this.stride] - this.raw[i], this.raw[i + this.stride + 1] - this.raw[i + 1]);
      const steps = Math.min(MAX_SEGMENT_STEPS, Math.max(1, Math.ceil(length / SEGMENT_STEP_PX)));
      this.live.push(...smoothSegment(this.raw, this.stride, this.appended, steps).slice(this.stride));
    }
  }
}
