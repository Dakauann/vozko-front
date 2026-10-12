import { describe, expect, it } from "vitest";

import { laidLines } from "./text-layout";

const measure = (text: string) => [...text].length * 10;

describe("laid lines", () => {
  it("places wrapped lines in the middle of the box like the text renderer", () => {
    const lines = laidLines({ lines: [{ text: "ab cd", width: 50 }, { text: "ef", width: 20 }], align: "left", box: { x: 5, y: 10, width: 100, height: 80 }, lineHeightPx: 24, letterSpacingPx: 0, measure });
    expect(lines.map((line) => [line.top, line.height])).toEqual([
      [26, 24],
      [50, 24],
    ]);
    expect(lines[0].chars.map((c) => [c.char, c.left, c.right])).toEqual([
      ["a", 5, 15],
      ["b", 15, 25],
      [" ", 25, 35],
      ["c", 35, 45],
      ["d", 45, 55],
    ]);
  });

  it("aligns each line and adds letter spacing after every letter", () => {
    const centered = laidLines({ lines: [{ text: "ef", width: 20 }], align: "center", box: { x: 0, y: 0, width: 100, height: 24 }, lineHeightPx: 24, letterSpacingPx: 0, measure });
    expect(centered[0].chars[0].left).toBe(40);
    const right = laidLines({ lines: [{ text: "ef", width: 24 }], align: "right", box: { x: 0, y: 0, width: 100, height: 24 }, lineHeightPx: 24, letterSpacingPx: 4, measure });
    expect(right[0].chars.map((c) => [c.left, c.right])).toEqual([
      [76, 86],
      [90, 100],
    ]);
  });
});
