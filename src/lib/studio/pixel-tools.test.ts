import { describe, expect, it } from "vitest";

import type { KeyStroke } from "@/lib/keyboard/stroke";
import { newPaintLayer } from "./pixel-surface";
import { pixelFrame } from "./pixel-space";
import { brushStroke, DEFAULT_BRUSH, nextBrushSize, pixelKeyActionFor, StrokeBuilder, PIXEL_TOOL_KEYS } from "./pixel-tools";

function key(key: string, patch: Partial<KeyStroke> = {}): KeyStroke {
  return { key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...patch };
}

const idle = { tool: null, hasSelection: false } as const;
const brushing = { tool: "brush", hasSelection: false } as const;

describe("pixel keys", () => {
  it("picks the tools", () => {
    expect(pixelKeyActionFor(key("b"), idle)).toEqual({ type: "tool", tool: "brush" });
    expect(pixelKeyActionFor(key("e"), idle)).toEqual({ type: "tool", tool: "eraser" });
    expect(pixelKeyActionFor(key("m"), idle)).toEqual({ type: "tool", tool: "rect" });
    expect(pixelKeyActionFor(key("M", { shiftKey: true }), idle)).toEqual({ type: "tool", tool: "ellipse" });
    expect(pixelKeyActionFor(key("l"), idle)).toEqual({ type: "tool", tool: "lasso" });
    expect(PIXEL_TOOL_KEYS).toMatchObject({ brush: "B", ellipse: "Shift+M" });
  });

  it("sizes, hardens and doses the brush only while painting", () => {
    expect(pixelKeyActionFor(key("]", { code: "BracketRight" }), brushing)).toEqual({ type: "size", direction: 1 });
    expect(pixelKeyActionFor(key("{", { code: "BracketLeft", shiftKey: true }), brushing)).toEqual({ type: "hardness", direction: -1 });
    expect(pixelKeyActionFor(key("5", { code: "Digit5" }), brushing)).toEqual({ type: "opacity", value: 0.5 });
    expect(pixelKeyActionFor(key("0", { code: "Digit0" }), brushing)).toEqual({ type: "opacity", value: 1 });
    expect(pixelKeyActionFor(key("x"), brushing)).toEqual({ type: "swap" });
    expect(pixelKeyActionFor(key("]", { code: "BracketRight" }), idle)).toBeNull();
    expect(pixelKeyActionFor(key("5", { code: "Digit5" }), idle)).toBeNull();
  });

  it("acts on the selection with Delete, Esc, Ctrl+Shift+I and Ctrl+J", () => {
    const selected = { tool: null, hasSelection: true } as const;
    expect(pixelKeyActionFor(key("Delete"), selected)).toEqual({ type: "erase" });
    expect(pixelKeyActionFor(key("Escape"), selected)).toEqual({ type: "deselect" });
    expect(pixelKeyActionFor(key("I", { ctrlKey: true, shiftKey: true }), selected)).toEqual({ type: "invert" });
    expect(pixelKeyActionFor(key("j", { ctrlKey: true }), selected)).toEqual({ type: "copy" });
    expect(pixelKeyActionFor(key("Delete"), idle)).toBeNull();
    expect(pixelKeyActionFor(key("Escape"), brushing)).toEqual({ type: "tool", tool: null });
    expect(pixelKeyActionFor(key("Escape"), idle)).toBeNull();
  });

  it("never steals keys from text fields or shortcuts with modifiers", () => {
    const input = document.createElement("input");
    expect(pixelKeyActionFor(key("b", { target: input }), idle)).toBeNull();
    expect(pixelKeyActionFor(key("b", { ctrlKey: true }), idle)).toBeNull();
    expect(pixelKeyActionFor(key("e", { altKey: true }), idle)).toBeNull();
  });
});

describe("brush settings", () => {
  it("steps the size finer for small brushes", () => {
    expect(nextBrushSize(4, 1)).toBe(5);
    expect(nextBrushSize(40, 1)).toBe(45);
    expect(nextBrushSize(200, -1)).toBe(175);
    expect(nextBrushSize(1, -1)).toBe(1);
    expect(nextBrushSize(1000, 1)).toBe(1000);
  });

  it("builds a stroke in surface pixels from the brush", () => {
    const frame = pixelFrame({ ...newPaintLayer({ width: 400, height: 400 }), surface: { width: 800, height: 800, ops: [] } }, { width: 400, height: 400 }, "paint")!;
    expect(brushStroke({ ...DEFAULT_BRUSH, size: 30, color: "#123456" }, frame, "paint", "id", false)).toEqual({ kind: "stroke", id: "id", mode: "paint", color: "#123456", size: 60, hardness: DEFAULT_BRUSH.hardness, opacity: 1, points: [] });
    expect(brushStroke(DEFAULT_BRUSH, frame, "erase", "id", true)).toMatchObject({ mode: "erase", pressure: true });
    expect(brushStroke(DEFAULT_BRUSH, frame, "erase", "id", false).color).toBeUndefined();
  });
});

describe("stroke builder", () => {
  const frame = pixelFrame(newPaintLayer({ width: 200, height: 200 }), { width: 200, height: 200 }, "paint")!;

  it("grows a smoothed live stroke and lags one segment behind the pointer", () => {
    const builder = new StrokeBuilder(frame, brushStroke(DEFAULT_BRUSH, frame, "paint", "s", false));
    expect(builder.add({ x: 10, y: 10 }, 1).points).toEqual([10, 10]);
    expect(builder.add({ x: 30, y: 10 }, 1).points).toEqual([10, 10]);
    const third = builder.add({ x: 50, y: 30 }, 1).points;
    expect(third.slice(-2)).toEqual([30, 10]);
    const done = builder.finish();
    expect(done.points.slice(0, 2)).toEqual([10, 10]);
    expect(done.points.slice(-2)).toEqual([50, 30]);
  });

  it("keeps pressure for pens and commits a single click as one dab", () => {
    const pen = new StrokeBuilder(frame, brushStroke(DEFAULT_BRUSH, frame, "paint", "p", true));
    pen.add({ x: 5, y: 5 }, 0.3);
    pen.add({ x: 25, y: 5 }, 0.9);
    expect(pen.finish()).toMatchObject({ pressure: true, points: [5, 5, 0.3, 25, 5, 0.9] });
    const click = new StrokeBuilder(frame, brushStroke(DEFAULT_BRUSH, frame, "paint", "c", false));
    click.add({ x: 7, y: 8 }, 1);
    expect(click.finish().points).toEqual([7, 8]);
  });
});
