import type { Layout } from "../auto-layout";
import { newShapeLayer, newStudioId, type CanvasSize, type Layer, type StudioGroup, type Transform } from "../document";
import { frameSlotLayer, type FrameShape } from "./frame-shapes";
import type { LibraryLayers } from "./model";
import { previewSvg } from "./preview";

export type GridDirection = "row" | "column";

export type GridNode = { weight?: number } & ({ cell: FrameShape } | { split: GridDirection; children: readonly GridNode[] });

export interface GridRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface GridCell {
  rect: GridRect;
  shape: FrameShape;
}

export interface GridArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const GRID_GAP_SHARE = 0.012;
export const GRID_BACKGROUND = "#ffffff";
export const GRID_CLEAR = "#ffffff00";
export const FULL_AREA: GridArea = { x: 0.5, y: 0.5, w: 1, h: 1 };

const PREVIEW_GAP = 1.5;

const RECT: FrameShape = { kind: "rect", radius: 0 };

export function cellNode(shape: FrameShape = RECT, weight?: number): GridNode {
  return { cell: shape, ...(weight !== undefined ? { weight } : {}) };
}

export function splitNode(split: GridDirection, children: readonly GridNode[], weight?: number): GridNode {
  return { split, children, ...(weight !== undefined ? { weight } : {}) };
}

export function gridGap(canvas: CanvasSize, area: GridArea = FULL_AREA): number {
  return Math.min(canvas.width * area.w, canvas.height * area.h) * GRID_GAP_SHARE;
}

function inset(rect: GridRect, by: number): GridRect {
  return { left: rect.left + by, top: rect.top + by, width: rect.width - 2 * by, height: rect.height - 2 * by };
}

function childRects(node: Extract<GridNode, { split: GridDirection }>, rect: GridRect, gap: number): GridRect[] {
  const total = node.children.reduce((sum, child) => sum + (child.weight ?? 1), 0);
  const along = node.split === "row" ? rect.width : rect.height;
  const room = along - gap * (node.children.length - 1);
  let cursor = node.split === "row" ? rect.left : rect.top;
  return node.children.map((child) => {
    const size = (room * (child.weight ?? 1)) / total;
    const placed = node.split === "row" ? { left: cursor, top: rect.top, width: size, height: rect.height } : { left: rect.left, top: cursor, width: rect.width, height: size };
    cursor += size + gap;
    return placed;
  });
}

function collect(node: GridNode, rect: GridRect, gap: number, into: GridCell[]): void {
  if ("cell" in node) {
    into.push({ rect, shape: node.cell });
    return;
  }
  childRects(node, rect, gap).forEach((child, index) => collect(node.children[index], child, gap, into));
}

export function areaRect(canvas: CanvasSize, area: GridArea): GridRect {
  const width = area.w * canvas.width;
  const height = area.h * canvas.height;
  return { left: area.x * canvas.width - width / 2, top: area.y * canvas.height - height / 2, width, height };
}

export function gridCells(root: GridNode, canvas: CanvasSize, area: GridArea = FULL_AREA, gap: number = gridGap(canvas, area)): GridCell[] {
  const cells: GridCell[] = [];
  collect(root, inset(areaRect(canvas, area), gap), gap, cells);
  return cells;
}

export function cellCount(root: GridNode): number {
  return "cell" in root ? 1 : root.children.reduce((sum, child) => sum + cellCount(child), 0);
}

function transformOf(rect: GridRect, canvas: CanvasSize): Transform {
  return { x: (rect.left + rect.width / 2) / canvas.width, y: (rect.top + rect.height / 2) / canvas.height, w: rect.width / canvas.width, h: rect.height / canvas.height, rotation: 0, opacity: 1 };
}

function layoutOf(direction: GridDirection, gap: number, padding: number): Layout {
  return {
    direction: direction === "row" ? "horizontal" : "vertical",
    ...(gap > 0 ? { gap } : {}),
    ...(padding > 0 ? { padding: { top: padding, right: padding, bottom: padding, left: padding } } : {}),
    width: "fixed",
    height: "fixed",
  };
}

function baseLayer(rect: GridRect, canvas: CanvasSize, fill: string): Layer {
  return { ...newShapeLayer("rect", transformOf(rect, canvas)), fill };
}

interface Built {
  layers: Layer[];
  groups: StudioGroup[];
}

function buildSplit(node: Extract<GridNode, { split: GridDirection }>, rect: GridRect, inner: GridRect, gap: number, canvas: CanvasSize, parentId: string | undefined, root: { fill: string; padding: number } | null, into: Built): void {
  const base = baseLayer(rect, canvas, root ? root.fill : GRID_CLEAR);
  const group: StudioGroup = { id: newStudioId("g"), baseId: base.id, layout: layoutOf(node.split, gap, root ? root.padding : 0), ...(parentId ? { parentId } : {}) };
  into.groups.push(group);
  into.layers.push({ ...base, groupId: group.id });
  childRects(node, inner, gap).forEach((childRect, index) => {
    const child = node.children[index];
    if ("cell" in child) into.layers.push({ ...frameSlotLayer(child.cell, transformOf(childRect, canvas)), groupId: group.id });
    else buildSplit(child, childRect, childRect, gap, canvas, group.id, null, into);
  });
}

export function gridLayers(root: GridNode, canvas: CanvasSize, area: GridArea = FULL_AREA): LibraryLayers {
  const gap = gridGap(canvas, area);
  const outer = areaRect(canvas, area);
  const node: Extract<GridNode, { split: GridDirection }> = "cell" in root ? { split: "row", children: [root] } : root;
  const built: Built = { layers: [], groups: [] };
  buildSplit(node, outer, inset(outer, gap), gap, canvas, undefined, { fill: GRID_BACKGROUND, padding: gap }, built);
  return built;
}

export function gridMarkup(root: GridNode, ratio: number): string {
  const width = ratio >= 1 ? 30 : 30 * ratio;
  const height = ratio >= 1 ? 30 / ratio : 30;
  const canvas = { width, height };
  const cells = gridCells(root, canvas, FULL_AREA, PREVIEW_GAP).map(({ rect }) => {
    const x = Math.round((rect.left + (40 - width) / 2) * 100) / 100;
    const y = Math.round((rect.top + (40 - height) / 2) * 100) / 100;
    return `<rect x="${x}" y="${y}" width="${Math.round(rect.width * 100) / 100}" height="${Math.round(rect.height * 100) / 100}" rx="1" fill="currentColor"/>`;
  });
  return previewSvg(cells.join(""), 40);
}
