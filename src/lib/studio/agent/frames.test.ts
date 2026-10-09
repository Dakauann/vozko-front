import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "../document";
import { lookTimes, rowSheet, sheetLayout, timecode } from "./frames";

describe("rowSheet", () => {
  it("lays artboards of any shape side by side at one height, wrapping inside the long edge", () => {
    const sheet = rowSheet([1, 9 / 16, 16 / 9, 1], 1000, 24);
    expect(sheet.cells.every((cell) => cell.height === sheet.cells[0].height)).toBe(true);
    expect(sheet.cells[1].width / sheet.cells[1].height).toBeCloseTo(9 / 16, 2);
    expect(Math.max(...sheet.cells.map((cell) => cell.x + cell.width))).toBeLessThanOrEqual(1000);
    expect(sheet.width).toBeLessThanOrEqual(1000);
    expect(sheet.height).toBeLessThanOrEqual(1000);
    expect(new Set(sheet.cells.map((cell) => cell.y)).size).toBeGreaterThan(0);
  });

  it("keeps a single artboard at the full long edge", () => {
    const sheet = rowSheet([16 / 9], 1000, 24);
    expect(sheet.cells[0].width).toBeGreaterThan(990);
    expect(sheet.cells[0].width).toBeLessThanOrEqual(1000);
    expect(sheet.height).toBe(sheet.cells[0].height);
  });
});

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", "a", 0, 4000), id: "a" }, { ...newMediaClip("video", "b", 4000, 2000), id: "b" }] },
    { id: "v2", kind: "visual", hidden: true, clips: [{ ...newMediaClip("image", "c", 1000, 1000), id: "c" }] },
  ];
  d.durationMs = 6000;
  return d;
}

describe("lookTimes", () => {
  it("looks once inside every stretch between visible cuts", () => {
    expect(lookTimes(doc(), { count: 2 })).toEqual([2000, 5000]);
  });

  it("fills the rest evenly when there are fewer cuts than frames asked", () => {
    const times = lookTimes(doc(), { count: 4 });
    expect(times).toHaveLength(4);
    expect(times).toContain(2000);
    expect(times).toContain(5000);
    expect([...times].sort((x, y) => x - y)).toEqual(times);
  });

  it("uses the exact moments asked, inside the video", () => {
    expect(lookTimes(doc(), { times_ms: [500, 99_000, -10] })).toEqual([0, 500, 5999]);
  });

  it("defaults to six frames and never more than nine", () => {
    expect(lookTimes(doc(), {})).toHaveLength(6);
    expect(lookTimes(doc(), { count: 40 })).toHaveLength(9);
    expect(lookTimes({ ...doc(), tracks: [], durationMs: 0 }, {})).toEqual([0]);
  });
});

describe("sheetLayout", () => {
  it("lays six portrait frames as a 3 by 2 grid within the long edge", () => {
    const layout = sheetLayout(6, 9 / 16, 1536);
    expect([layout.cols, layout.rows]).toEqual([3, 2]);
    expect(Math.max(layout.width, layout.height)).toBeLessThanOrEqual(1536);
    expect(layout.cellHeight / layout.cellWidth).toBeCloseTo(16 / 9, 1);
  });

  it("keeps a single frame whole", () => {
    expect(sheetLayout(1, 1, 1024)).toMatchObject({ cols: 1, rows: 1, width: 1024, height: 1024 });
  });
});

describe("timecode", () => {
  it("prints minutes, seconds and tenths", () => {
    expect(timecode(0)).toBe("0:00.0");
    expect(timecode(61_550)).toBe("1:01.5");
  });
});

describe("lookTimes defaults", () => {
  it("treats a zero count as the default six frames", () => {
    expect(lookTimes(doc(), { count: 0 })).toHaveLength(6);
  });
});
