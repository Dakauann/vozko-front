import { describe, expect, it } from "vitest";

import { headroomMs, localAtSource, retimed, sourceAt, sourceSpanMs, sourceTable, speedAt, speedIssue, splitTrimIns, tailroomMs, travelAlong, timeAfterTravel, trimInAfterEdge } from "./clip-time";
import { newMediaClip, type Clip } from "./document";
import type { Keyframe } from "./keyframes";

const RAMP: Keyframe[] = [
  { atMs: 0, value: 1, easing: "linear" },
  { atMs: 1000, value: 0.5, easing: "easeInOut" },
  { atMs: 3000, value: 2, easing: "linear" },
];

function curved(keys: Keyframe[] = RAMP, extra: Partial<Clip> = {}): Clip {
  return { ...newMediaClip("video", "a", 0, 4000), trimInMs: 1000, keyframes: { speed: keys }, ...extra };
}

describe("speed curves in the shared source time", () => {
  it("integrates the eased speed exactly enough that linear pieces match the closed form", () => {
    expect(travelAlong(RAMP, 0, 1000)).toBeCloseTo(750, 9);
    expect(travelAlong(RAMP, 1000, 3000)).toBeCloseTo(2000 * 1.25, 6);
    expect(travelAlong(RAMP, 3000, 4000)).toBeCloseTo(2000, 9);
    expect(travelAlong(RAMP, -500, 0)).toBeCloseTo(500, 9);
  });

  it("maps the timeline to the source and back through the curve", () => {
    const clip = curved();
    expect(speedAt(clip, 2000)).toBeCloseTo(1.25, 9);
    expect(sourceSpanMs(clip)).toBe(Math.round(750 + 2500 + 2000));
    expect(sourceAt(clip, 1000)).toBeCloseTo(1750, 9);
    for (const local of [0, 400, 1500, 2999, 3700]) expect(localAtSource(clip, sourceAt(clip, local))).toBeCloseTo(local, 5);
    expect(timeAfterTravel(RAMP, 0, travelAlong(RAMP, 0, 2200))).toBeCloseTo(2200, 5);
    expect(retimed(clip)).toBe(true);
  });

  it("plays the window backwards on a reversed curve", () => {
    const clip = curved(RAMP, { reverse: true });
    const span = sourceSpanMs(clip);
    expect(sourceAt(clip, 0)).toBeCloseTo(1000 + span - 2, 9);
    expect(sourceAt(clip, 1000)).toBeCloseTo(1000 + span - 2 - 750, 9);
    expect(localAtSource(clip, 1000 + span - 750)).toBeCloseTo(1000, 5);
  });

  it("trims and splits through the curve so the frame at the cut stays", () => {
    const clip = curved();
    expect(trimInAfterEdge(clip, "start", 1000)).toBe(1750);
    expect(trimInAfterEdge(clip, "end", 1000)).toBe(1000);
    const reversed = curved(RAMP, { reverse: true });
    expect(trimInAfterEdge(reversed, "end", 1000)).toBe(3000);
    expect(splitTrimIns(clip, 1000)).toEqual({ left: 1000, right: 1750 });
    expect(splitTrimIns(reversed, 3000)).toEqual({ left: 3000, right: 1000 });
  });

  it("measures the room before and after the window at the speed held past the ends", () => {
    const clip = curved();
    expect(headroomMs(clip, undefined)).toBeCloseTo(1000, 6);
    expect(tailroomMs(clip, sourceSpanMs(clip) + 1000 + 600)).toBeCloseTo(300, 6);
    expect(tailroomMs(clip, undefined)).toBe(Infinity);
  });

  it("builds a source table that adds up to the same travel", () => {
    const table = sourceTable(curved(), -200, 4200, 1);
    expect(table[table.length - 1]).toBeCloseTo(travelAlong(RAMP, -200, 4200), 6);
  });

  it("refuses a curve on stills, with a constant speed, on a freeze or dipping out of range", () => {
    expect(speedIssue(curved())).toBeNull();
    expect(speedIssue({ ...curved(), type: "image" })).toBe("invalid");
    expect(speedIssue(curved(RAMP, { speed: 2 }))).toBe("invalid");
    expect(speedIssue(curved(RAMP, { freeze: true }))).toBe("invalid");
    expect(speedIssue(curved([{ atMs: 0, value: 2, easing: "backOut" }, { atMs: 1000, value: 0.1, easing: "linear" }]))).toBe("out_of_range");
    expect(speedIssue({ ...newMediaClip("image", "a", 0, 1000), frameMix: true })).toBe("invalid");
    expect(speedIssue({ ...newMediaClip("video", "a", 0, 1000), frameMix: true })).toBeNull();
  });
});
