import { describe, expect, it } from "vitest";

import { newPathLayer, newShapeLayer, type Layer } from "./document";
import type { ResolvedLine } from "./line-animation";
import { lineFrame, wiggleNoise, type LineFrame, type LinePoint } from "./line-geometry";

const WIDTH = 400;
const HEIGHT = 100;

function placed(layer: Layer): Layer {
  return { ...layer, transform: { x: 0.5, y: 0.5, w: 200 / WIDTH, h: 20 / HEIGHT, rotation: 0, opacity: 1 } };
}

function line(extra: Partial<Layer> = {}): Layer {
  return placed({ ...newShapeLayer("line"), strokeWidth: 4, lineCap: "butt", ...extra });
}

function frameOf(layer: Layer, resolved: ResolvedLine = {}, step = 2): LineFrame {
  return lineFrame({ layer, widthPx: WIDTH, heightPx: HEIGHT, line: resolved, color: "#ff0000", step });
}

function ends(points: readonly LinePoint[]): [LinePoint, LinePoint] {
  return [points[0], points[points.length - 1]];
}

describe("line frame geometry", () => {
  it("draws a still line as one open run across its box, in raster pixels", () => {
    const frame = frameOf(line());
    expect(frame.runs).toHaveLength(1);
    const [first, last] = ends(frame.runs[0].points);
    expect(first.x).toBeCloseTo(100);
    expect(first.y).toBeCloseTo(50);
    expect(last.x).toBeCloseTo(300);
    expect(frame.runs[0].closed).toBe(false);
    expect(frame.uniform).toBe(true);
    expect(frame.width).toBe(4);
  });

  it("draws on with the trim end and travels with the offset", () => {
    const half = frameOf(line(), { trim: { start: 0, end: 0.5, offset: 0, sequential: false } });
    expect(ends(half.runs[0].points)[1].x).toBeCloseTo(200);
    const empty = frameOf(line(), { trim: { start: 0.3, end: 0.3, offset: 0, sequential: false } });
    expect(empty.runs).toHaveLength(0);
    const travelling = frameOf(line(), { trim: { start: 0, end: 0.25, offset: 288, sequential: false } });
    expect(travelling.runs).toHaveLength(2);
    expect(ends(travelling.runs[0].points)[0].x).toBeCloseTo(260);
    expect(ends(travelling.runs[1].points)[1].x).toBeCloseTo(110);
  });

  it("keeps a closed outline as one continuous run when the trim wraps past its start", () => {
    const ring = placed({ ...newShapeLayer("rect"), stroke: "#000000", strokeWidth: 2 });
    const full = frameOf(ring);
    expect(full.runs).toHaveLength(1);
    expect(full.runs[0].closed).toBe(true);
    const wrapped = frameOf(ring, { trim: { start: 0.8, end: 1, offset: 36, sequential: false } });
    expect(wrapped.runs).toHaveLength(1);
    expect(wrapped.runs[0].closed).toBe(false);
  });

  it("bends the centerline by the wave amount and slides it by the turns", () => {
    const waved = frameOf(line(), { wave: { mode: "bend", amount: 10, wavelength: 100, turns: 0 } }, 1);
    const peak = waved.runs[0].points.find((point) => Math.abs(point.x - 125) < 1e-6)!;
    expect(Math.abs(peak.y - 50)).toBeCloseTo(10, 4);
    const slid = frameOf(line(), { wave: { mode: "bend", amount: 10, wavelength: 100, turns: 0.25 } }, 1);
    const moved = slid.runs[0].points.find((point) => Math.abs(point.x - 125) < 1e-6)!;
    expect(Math.abs(moved.y - 50)).toBeLessThan(1e-6);
    expect(waved.uniform).toBe(true);
  });

  it("pulses the thickness in width mode instead of moving the line", () => {
    const pulsing = frameOf(line(), { wave: { mode: "width", amount: 3, wavelength: 100, turns: 0 } }, 1);
    expect(pulsing.uniform).toBe(false);
    const widths = pulsing.runs[0].points.map((point) => point.width);
    expect(Math.max(...widths)).toBeCloseTo(7, 4);
    expect(Math.min(...widths)).toBeCloseTo(1, 4);
    expect(pulsing.runs[0].points.every((point) => Math.abs(point.y - 50) < 1e-9)).toBe(true);
  });

  it("wiggles deterministically within its size, and the seed changes the pattern", () => {
    const wiggle = { size: 6, detail: 4, time: 1.3, seed: 3 };
    const a = frameOf(line(), { wiggle });
    const b = frameOf(line(), { wiggle });
    expect(a).toEqual(b);
    const offsets = a.runs[0].points.map((point) => Math.abs(point.y - 50));
    expect(Math.max(...offsets)).toBeGreaterThan(0.5);
    expect(Math.max(...offsets)).toBeLessThanOrEqual(6 * Math.SQRT2 + 1e-9);
    const other = frameOf(line(), { wiggle: { ...wiggle, seed: 4 } });
    expect(other.runs[0].points.map((point) => point.y)).not.toEqual(a.runs[0].points.map((point) => point.y));
  });

  it("gives smooth seeded noise in -1 to 1 that repeats over its period", () => {
    const value = wiggleNoise(2.4, 0.7, 5, 9, 0);
    expect(value).toBe(wiggleNoise(2.4, 0.7, 5, 9, 0));
    expect(Math.abs(value)).toBeLessThanOrEqual(1);
    expect(wiggleNoise(0.2, 0.7, 5, 9, 0)).toBeCloseTo(wiggleNoise(5.2, 0.7, 5, 9, 0), 9);
    expect(Math.abs(wiggleNoise(1.001, 0.5, 0, 2, 1) - wiggleNoise(1, 0.5, 0, 2, 1))).toBeLessThan(0.01);
  });

  it("tapers the ends of each visible run on the full path length", () => {
    const taper = { startLength: 0.25, endLength: 0.25, startWidth: 0, endWidth: 0.5, startEase: 0, endEase: 0 };
    const tapered = frameOf(line(), { taper }, 1);
    const points = tapered.runs[0].points;
    expect(points[0].width).toBeCloseTo(0);
    expect(points[points.length - 1].width).toBeCloseTo(2);
    expect(points.find((point) => Math.abs(point.x - 200) < 1e-6)!.width).toBeCloseTo(4);
    expect(points.find((point) => Math.abs(point.x - 125) < 1e-6)!.width).toBeCloseTo(2);
    const drawing = frameOf(line(), { taper, trim: { start: 0, end: 0.5, offset: 0, sequential: false } });
    const tip = drawing.runs[0].points;
    expect(tip.find((point) => Math.abs(point.x - 150) < 1e-6)!.width).toBeCloseTo(4);
  });

  it("splits dashes anchored to the path start, so trimming never slides them", () => {
    const dashed = line({ dashArray: [3, 2] });
    const frame = frameOf(dashed);
    expect(frame.runs).toHaveLength(10);
    expect(ends(frame.runs[0].points)[1].x).toBeCloseTo(112);
    const trimmed = frameOf(dashed, { trim: { start: 0.05, end: 1, offset: 0, sequential: false } });
    expect(ends(trimmed.runs[0].points)[0].x).toBeCloseTo(110);
    expect(ends(trimmed.runs[1].points)[0].x).toBeCloseTo(120);
  });

  it("puts arrow heads on the visible ends", () => {
    const arrow = line({ arrowEnd: true });
    const frame = frameOf(arrow, { trim: { start: 0, end: 0.5, offset: 0, sequential: false } });
    expect(frame.heads).toHaveLength(1);
    expect(frame.heads[0].stroked).toBe(true);
    expect(frame.heads[0].points[2]).toBeCloseTo(200);
    expect(frame.heads[0].points[3]).toBeCloseTo(50);
    const path = placed({ ...newPathLayer("M0 0.5 L1 0.5", undefined, true), strokeWidth: 4, arrowStart: true });
    const pathHeads = frameOf(path).heads;
    expect(pathHeads).toHaveLength(1);
    expect(pathHeads[0].stroked).toBe(false);
    expect(pathHeads[0].points[2]).toBeCloseTo(100 - 12);
  });

  it("trims every subpath alike, or all of them as one in sequence", () => {
    const two = placed({ ...newPathLayer("M0 0 L1 0 M0 1 L1 1", undefined, true), strokeWidth: 2 });
    const together = frameOf(two, { trim: { start: 0, end: 0.5, offset: 0, sequential: false } });
    expect(together.runs).toHaveLength(2);
    const sequence = frameOf(two, { trim: { start: 0, end: 0.5, offset: 0, sequential: true } });
    expect(sequence.runs).toHaveLength(1);
    expect(ends(sequence.runs[0].points)[1].x).toBeCloseTo(300);
  });

  it("follows the rotation of the layer box", () => {
    const turned = { ...line(), transform: { ...line().transform, rotation: 90 } };
    const [first, last] = ends(frameOf(turned).runs[0].points);
    expect(first.x).toBeCloseTo(200);
    expect(first.y).toBeCloseTo(-50);
    expect(last.y).toBeCloseTo(150);
  });
});
