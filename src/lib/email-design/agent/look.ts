import { rowSheet, VISION_BUDGET, type SheetCell, type VisionBudget } from "@/lib/vision/sheet";

import { MOBILE_VIEWPORT } from "../look";
import type { BlockKind, Document } from "../types";

export type LookDevice = "desktop" | "mobile";

export const LOOK_WIDTHS: Record<LookDevice, number> = { desktop: 640, mobile: MOBILE_VIEWPORT };
export const FOCUS_MARGIN = 24;
export const SHEET_GAP = 12;
const MAX_SLICES_PER_DEVICE = 8;

export interface LookRequest {
  html: string;
  devices: LookDevice[];
  dark: boolean;
  focusId: string | null;
  marks: boolean;
}

const DEVICES: Record<string, LookDevice[]> = { both: ["desktop", "mobile"], desktop: ["desktop"], mobile: ["mobile"] };

export function lookRequestOf(args: unknown): LookRequest | null {
  if (!args || typeof args !== "object") return null;
  const raw = args as Record<string, unknown>;
  const devices = typeof raw.device === "string" ? DEVICES[raw.device] : undefined;
  if (typeof raw.html !== "string" || raw.html === "" || !devices) return null;
  if (raw.scheme !== "light" && raw.scheme !== "dark") return null;
  const focusId = typeof raw.focus_id === "string" && raw.focus_id !== "" ? raw.focus_id : null;
  return { html: raw.html, devices, dark: raw.scheme === "dark", focusId, marks: raw.marks === true };
}

export interface CaptureSize {
  device: LookDevice;
  width: number;
  height: number;
}

export interface Slice {
  device: LookDevice;
  index: number;
  of: number;
  top: number;
  height: number;
  cell: SheetCell;
}

export interface SliceSheet {
  width: number;
  height: number;
  slices: Slice[];
}

function slicesAt(captures: readonly CaptureSize[], sliceHeight: number, budget: VisionBudget, gap: number): SliceSheet & { scale: number } {
  const parts = captures.flatMap((capture) => {
    const count = Math.max(1, Math.ceil(capture.height / sliceHeight));
    return Array.from({ length: count }, (_, index) => ({ device: capture.device, index: index + 1, of: count, top: index * sliceHeight, height: Math.min(sliceHeight, capture.height - index * sliceHeight), width: capture.width }));
  });
  const sheet = rowSheet(parts.map((part) => part.width / sliceHeight), budget, gap);
  const slices = parts.map((part, i) => ({ device: part.device, index: part.index, of: part.of, top: part.top, height: part.height, cell: sheet.cells[i] }));
  return { width: sheet.width, height: sheet.height, slices, scale: sheet.cells[0].height / sliceHeight };
}

export function sliceSheet(captures: readonly CaptureSize[], budget: VisionBudget = VISION_BUDGET, gap = SHEET_GAP): SliceSheet {
  const tallest = Math.max(...captures.map((capture) => capture.height));
  let best = slicesAt(captures, tallest, budget, gap);
  for (let count = 2; count <= MAX_SLICES_PER_DEVICE; count++) {
    const candidate = slicesAt(captures, Math.ceil(tallest / count), budget, gap);
    if (candidate.scale > best.scale) best = candidate;
  }
  return { width: best.width, height: best.height, slices: best.slices };
}

export interface MarkLegend {
  n: number;
  id: string;
  kind: BlockKind;
}

export function markLegend(doc: Document): MarkLegend[] {
  const legend: MarkLegend[] = [];
  for (const block of doc.blocks) {
    legend.push({ n: legend.length + 1, id: block.id, kind: block.kind });
    if (block.kind !== "columns") continue;
    for (const column of block.columns.columns) {
      for (const child of column.blocks) legend.push({ n: legend.length + 1, id: child.id, kind: child.kind });
    }
  }
  return legend;
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function focusBox(block: Box, page: { width: number; height: number }, margin: number = FOCUS_MARGIN): Box {
  const left = Math.max(0, block.left - margin);
  const top = Math.max(0, block.top - margin);
  const right = Math.min(page.width, block.left + block.width + margin);
  const bottom = Math.min(page.height, block.top + block.height + margin);
  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}
