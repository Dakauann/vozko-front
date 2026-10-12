import { describe, expect, it } from "vitest";

import { newTextLayer, type Layer } from "./document";
import { curvedGlyphs, layoutRichText, richLaidLines, runFont, type RichMeasure } from "./rich-text-layout";
import { collapsedSpans, textSpans } from "./text-runs";

const measure: RichMeasure = {
  width: (text, font) => [...text].length * font.sizePx * 0.5,
  metrics: (font) => ({ ascent: font.sizePx * 0.8, descent: font.sizePx * 0.2 }),
};

function layer(text: string, extra: Partial<Layer> = {}): Layer {
  return { ...newTextLayer(text), fontId: "inter", fontWeight: 400, fontSize: 0.2, lineHeight: 1.2, letterSpacing: 0, fill: "#000000", align: "left", ...extra };
}

function laid(text: string, extra: Partial<Layer> = {}, box = { x: 0, y: 0, width: 100, height: 100 }) {
  const l = layer(text, extra);
  return layoutRichText({ spans: textSpans(l), box, align: l.align ?? "left", lineHeight: l.lineHeight ?? 1.2, fontBasePx: 100, measure, wrap: true, truncate: true });
}

describe("rich text layout", () => {
  it("places one style like the text renderer: middle of the box, baseline from the font box", () => {
    const layout = laid("ab cd", {}, { x: 5, y: 10, width: 100, height: 80 });
    expect(layout.lines).toHaveLength(1);
    const [line] = layout.lines;
    expect(line.top).toBe(10 + (80 - 24) / 2);
    expect(line.height).toBe(24);
    expect(line.baseline).toBe(line.top + (16 - 4) / 2 + 12);
    expect(line.width).toBe(50);
    expect(line.segments).toHaveLength(1);
    expect(line.segments[0].chars.map((c) => [c.char, c.left, c.right])).toEqual([
      ["a", 5, 15],
      ["b", 15, 25],
      [" ", 25, 35],
      ["c", 35, 45],
      ["d", 45, 55],
    ]);
  });

  it("wraps at spaces across styles, trims the end of each line and skips the blanks after a break", () => {
    const layout = laid("aaa bbb ccc", { runs: [{ start: 4, end: 7, fontWeight: 800 }] }, { x: 0, y: 0, width: 80, height: 200 });
    expect(layout.lines.map((line) => line.segments.map((s) => s.text).join("|"))).toEqual(["aaa |bbb", "ccc"]);
    expect(layout.lines[0].width).toBe(70);
    expect(layout.lines[0].segments[1].style.fontWeight).toBe(800);
    expect(layout.lines[0].segments[1].x).toBe(40);
  });

  it("grows the line to its largest letters and shares one baseline", () => {
    const layout = laid("ab", { runs: [{ start: 1, end: 2, fontSize: 0.4 }] }, { x: 0, y: 0, width: 200, height: 100 });
    const [line] = layout.lines;
    expect(line.height).toBeCloseTo(48);
    expect(line.baseline).toBeCloseTo(line.top + Math.max((16 - 4) / 2 + 12, (32 - 8) / 2 + 24));
    expect(line.segments.map((s) => [s.text, s.x, s.width])).toEqual([
      ["a", 0, 10],
      ["b", 10, 20],
    ]);
  });

  it("adds letter spacing after every letter of the styled part only", () => {
    const layout = laid("abcd", { runs: [{ start: 2, end: 4, letterSpacing: 0.25 }] }, { x: 0, y: 0, width: 200, height: 100 });
    const [first, second] = layout.lines[0].segments;
    expect(first.width).toBe(20);
    expect(second.width).toBe(30);
    expect(second.chars.map((c) => [c.left, c.right])).toEqual([
      [20, 30],
      [35, 45],
    ]);
  });

  it("draws caps without changing the source positions", () => {
    const layout = laid("ab", { runs: [{ start: 0, end: 2, caps: true }] });
    expect(layout.lines[0].segments[0].text).toBe("AB");
    expect(layout.lines[0].segments[0].start).toBe(0);
    expect(layout.lines[0].segments[0].end).toBe(2);
  });

  it("aligns each line by its own width", () => {
    const right = laid("ab", { align: "right" }, { x: 0, y: 0, width: 100, height: 100 });
    expect(right.lines[0].x).toBe(80);
    const center = laid("ab", { align: "center" }, { x: 0, y: 0, width: 100, height: 100 });
    expect(center.lines[0].x).toBe(40);
  });

  it("breaks paragraphs on new lines, keeps empty lines and drops lines past the box like the text renderer", () => {
    const layout = laid("ab\n\ncd", {}, { x: 0, y: 0, width: 100, height: 100 });
    expect(layout.lines.map((line) => line.segments.map((s) => s.text).join(""))).toEqual(["ab", "", "cd"]);
    expect(layout.height).toBe(72);
    const cut = laid("ab\ncd\nef\ngh\nij", {}, { x: 0, y: 0, width: 100, height: 60 });
    expect(cut.lines).toHaveLength(2);
  });

  it("keeps a box with no wrap as wide as its longest line", () => {
    const l = layer("abcdef");
    const layout = layoutRichText({ spans: textSpans(l), box: { x: 0, y: 0, width: 10, height: 0 }, align: "left", lineHeight: 1.2, fontBasePx: 100, measure, wrap: false, truncate: false });
    expect(layout.lines).toHaveLength(1);
    expect(layout.width).toBe(60);
  });

  it("hands text animators every letter with its line", () => {
    const layout = laid("ab cd", { runs: [{ start: 3, end: 5, fontSize: 0.4 }] }, { x: 0, y: 0, width: 200, height: 100 });
    const lines = richLaidLines(layout);
    expect(lines).toHaveLength(1);
    expect(lines[0].chars.map((c) => c.char).join("")).toBe("ab cd");
    expect(lines[0].top).toBe(layout.lines[0].top);
  });

  it("builds fonts in pixels from the surface height", () => {
    expect(runFont({ fill: "", fontId: "inter", fontWeight: 700, fontSize: 0.1, italic: true, underline: false, caps: false, letterSpacing: 0.5 }, 200)).toEqual({ fontId: "inter", weight: 700, italic: true, sizePx: 20, letterSpacingPx: 10 });
  });

  it("puts each letter along a curve centered like the curved text renderer", () => {
    const l = layer("ab cd", { runs: [{ start: 3, end: 5, fill: "#ff0000" }] });
    const glyphs = curvedGlyphs({ spans: collapsedSpans(l), path: "M 0 50 L 200 50", lineHeight: 1.2, fontBasePx: 100, measure });
    expect(glyphs.map((g) => g.text).join("")).toBe("ab cd");
    expect(glyphs[0].x).toBeCloseTo(75);
    expect(glyphs[0].y).toBeCloseTo(50);
    expect(glyphs[0].rotation).toBeCloseTo(0);
    expect(glyphs[4].x).toBeCloseTo(115);
    expect(glyphs[4].style.fill).toBe("#ff0000");
  });
});
