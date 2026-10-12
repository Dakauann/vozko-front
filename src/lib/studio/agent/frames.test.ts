import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type VideoDocument } from "../document";
import { frameLabel, frameNote, lookPlan, lookRequestOf, lookTimes, MAX_LOOK_ZOOM, motionWindows, regionOf, rowSheet, sheetLayout, timecode, VISION_BUDGET, visionSize } from "./frames";

describe("rowSheet", () => {
  it("lays artboards of any shape side by side at one height, wrapping inside the long edge", () => {
    const sheet = rowSheet([1, 9 / 16, 16 / 9, 1], { longEdge: 1000, pixels: 1_000_000 }, 24);
    expect(sheet.cells.every((cell) => cell.height === sheet.cells[0].height)).toBe(true);
    expect(sheet.cells[1].width / sheet.cells[1].height).toBeCloseTo(9 / 16, 2);
    expect(Math.max(...sheet.cells.map((cell) => cell.x + cell.width))).toBeLessThanOrEqual(1000);
    expect(sheet.width).toBeLessThanOrEqual(1000);
    expect(sheet.height).toBeLessThanOrEqual(1000);
    expect(new Set(sheet.cells.map((cell) => cell.y)).size).toBeGreaterThan(0);
  });

  it("keeps a single artboard at the full long edge", () => {
    const sheet = rowSheet([16 / 9], { longEdge: 1000, pixels: 1_000_000 }, 24);
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
    const layout = sheetLayout(6, 9 / 16, { longEdge: 1536, pixels: 1536 * 1536 });
    expect([layout.cols, layout.rows]).toEqual([3, 2]);
    expect(Math.max(layout.width, layout.height)).toBeLessThanOrEqual(1536);
    expect(layout.cellHeight / layout.cellWidth).toBeCloseTo(16 / 9, 1);
  });

  it("keeps a single frame whole", () => {
    expect(sheetLayout(1, 1, { longEdge: 1024, pixels: 1024 * 1024 })).toMatchObject({ cols: 1, rows: 1, width: 1024, height: 1024 });
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

function motionDoc(): VideoDocument {
  const d = emptyVideoDocument("story");
  const title = { ...newOverlayClip(newTextLayer("Compre hoje mesmo"), 6000, 3000), id: "title" };
  title.textIn = { unit: "word", style: "rise", durationMs: 400, staggerMs: 100, easing: "easeOut" };
  title.keyframes = {
    y: [
      { atMs: 1000, value: 0.5, easing: "easeOut" },
      { atMs: 1600, value: 0.3, easing: "linear" },
    ],
  };
  const a = { ...newMediaClip("video", "a", 0, 4000), id: "a" };
  const b = { ...newMediaClip("video", "b", 4000, 5000), id: "b", fadeOutMs: 500 };
  d.tracks = [
    { id: "v1", kind: "visual", clips: [a, b], transitions: [{ id: "t1", fromClipId: "a", toClipId: "b", kind: "dissolve", durationMs: 600, alignment: "center", easing: "linear" }] },
    { id: "v2", kind: "visual", clips: [title] },
  ];
  d.durationMs = 9000;
  return d;
}

describe("visionSize", () => {
  it("fits the long edge and the pixel budget a vision model reads without resampling", () => {
    const size = visionSize(1080, 1920);
    expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(VISION_BUDGET.longEdge);
    expect(size.width * size.height).toBeLessThanOrEqual(VISION_BUDGET.pixels);
    expect(size.width / size.height).toBeCloseTo(1080 / 1920, 2);
    expect(size.width * size.height).toBeGreaterThan(VISION_BUDGET.pixels * 0.98);
  });

  it("enlarges a small crop so its detail fills the budget, up to the zoom limit", () => {
    const size = visionSize(200, 100);
    expect(size.width).toBe(200 * MAX_LOOK_ZOOM);
  });
});

describe("sheetLayout within the vision budget", () => {
  it("never asks the model to shrink a nine frame portrait sheet", () => {
    const layout = sheetLayout(9, 9 / 16);
    expect(layout.width * layout.height).toBeLessThanOrEqual(VISION_BUDGET.pixels);
    expect(Math.max(layout.width, layout.height)).toBeLessThanOrEqual(VISION_BUDGET.longEdge);
  });

  it("keeps a single frame as large as the budget allows", () => {
    const layout = sheetLayout(1, 9 / 16);
    expect(layout.cellWidth).toBeGreaterThan(780);
    expect(layout.width * layout.height).toBeLessThanOrEqual(VISION_BUDGET.pixels);
  });
});

describe("motionWindows", () => {
  it("lists transitions, entrances, exits, keyframe spans and text animators from the document", () => {
    const windows = motionWindows(motionDoc());
    expect(windows).toContainEqual({ id: "t1", kind: "transition", from_ms: 3700, to_ms: 4300 });
    expect(windows).toContainEqual({ id: "b", kind: "exit", from_ms: 8500, to_ms: 9000 });
    expect(windows).toContainEqual({ id: "title", kind: "keyframes", from_ms: 7000, to_ms: 7600 });
    expect(windows).toContainEqual({ id: "title", kind: "text_in", from_ms: 6000, to_ms: 6600 });
  });
});

describe("lookPlan", () => {
  it("samples a transition densely from its first to its last frame", () => {
    const plan = lookPlan(motionDoc(), { focus_id: "t1", count: 7 });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.times).toHaveLength(7);
    expect(plan.times[0]).toBe(3700);
    expect(plan.times[6]).toBe(4299);
    expect(plan.dense).toBe(true);
  });

  it("spreads the frames over every motion of a clip", () => {
    const plan = lookPlan(motionDoc(), { focus_id: "title", count: 8 });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.times.some((t) => t >= 6000 && t < 6600)).toBe(true);
    expect(plan.times.some((t) => t >= 7000 && t <= 7600)).toBe(true);
    expect(plan.windows.map((w) => w.kind)).toEqual(["text_in", "keyframes"]);
  });

  it("samples an explicit window evenly, both ends included", () => {
    const plan = lookPlan(motionDoc(), { from_ms: 1000, to_ms: 1501, count: 6 });
    expect(plan.ok && plan.times).toEqual([1000, 1100, 1200, 1300, 1400, 1500]);
  });

  it("refuses a focus that is neither a clip nor a transition", () => {
    const plan = lookPlan(motionDoc(), { focus_id: "nope" });
    expect(plan.ok).toBe(false);
  });

  it("falls back to the stills between cuts when nothing narrows the look", () => {
    const plan = lookPlan(doc(), { count: 2 });
    expect(plan.ok && plan.times).toEqual([2000, 5000]);
    expect(plan.ok && plan.dense).toBe(false);
  });
});

describe("frameNote", () => {
  it("states where a moving clip is and how far its transition has gone", () => {
    const note = frameNote(motionDoc(), 4000, null);
    const a = note.clips.find((c) => c.id === "a");
    expect(a?.transition).toEqual({ id: "t1", kind: "dissolve", progress: 0.5 });
    const b = note.clips.find((c) => c.id === "b");
    expect(b?.transition).toEqual({ id: "t1", kind: "dissolve", progress: 0.5 });
  });

  it("gives keyframed values mid move and leaves still clips plain", () => {
    const note = frameNote(motionDoc(), 7300, null);
    const title = note.clips.find((c) => c.id === "title");
    expect(title?.state?.y).toBeGreaterThan(0.3);
    expect(title?.state?.y).toBeLessThan(0.5);
    expect(title?.text).toBe("Compre hoje mesmo");
    expect(title?.text_in).toBe(1);
    const still = frameNote(doc(), 2000, null).clips.find((c) => c.id === "a");
    expect(still?.state).toBeUndefined();
  });

  it("reports the entrance progress of a text animator", () => {
    const note = frameNote(motionDoc(), 6300, null);
    expect(note.clips.find((c) => c.id === "title")?.text_in).toBe(0.5);
  });
});

describe("frameLabel", () => {
  it("prints hundredths when frames are closer than a tenth of a second", () => {
    expect(frameLabel(0, 1234, false)).toBe("1 · 0:01.2");
    expect(frameLabel(2, 1234, true)).toBe("3 · 0:01.23");
  });
});

describe("regionOf", () => {
  it("reads a centered box like a layer transform and keeps it inside the frame", () => {
    const caption = regionOf({ x: 0.5, y: 0.85, w: 1, h: 0.3 })!;
    expect(caption.left).toBe(0);
    expect(caption.top).toBeCloseTo(0.7, 9);
    expect([caption.width, caption.height]).toEqual([1, 0.3]);
    const edge = regionOf({ x: 0.95, y: 0.5, w: 0.2, h: 0.2 })!;
    expect(edge.left).toBeCloseTo(0.8, 9);
    expect(edge.top).toBeCloseTo(0.4, 9);
    expect(regionOf({ x: 0.5, y: 0.5, w: 0, h: 0.2 })).toBeNull();
    expect(regionOf(undefined)).toBeNull();
  });
});

describe("lookRequestOf", () => {
  it("reads the look arguments the tool sends and drops malformed ones", () => {
    expect(lookRequestOf({ times_ms: [100, "x", 200], count: 4, from_ms: 10, to_ms: 900, focus_id: "t1", region: { x: 0.5, y: 0.8, w: 1, h: 0.3 } })).toEqual({
      times_ms: [100, 200],
      count: 4,
      from_ms: 10,
      to_ms: 900,
      focus_id: "t1",
      region: { x: 0.5, y: 0.8, w: 1, h: 0.3 },
    });
    expect(lookRequestOf({ region: { x: 0.5 } })).toEqual({});
    expect(lookRequestOf(undefined)).toEqual({});
  });
});

describe("sheetLayout picks the grid with the largest frames", () => {
  it("lays four portrait frames as 2 by 2 instead of leaving empty cells", () => {
    expect(sheetLayout(4, 9 / 16)).toMatchObject({ cols: 2, rows: 2 });
  });

  it("lays nine portrait frames as 3 by 3", () => {
    const layout = sheetLayout(9, 9 / 16);
    expect([layout.cols, layout.rows]).toEqual([3, 3]);
    expect(layout.cellWidth).toBeGreaterThan(260);
  });
});
