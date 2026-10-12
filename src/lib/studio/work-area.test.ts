import { describe, expect, it } from "vitest";

import { clampSpan, filmSpan, insideSpan, playSpan, playStart, spanLength, workArea } from "./work-area";

describe("work area", () => {
  it("is the marked in and out range, kept inside the film", () => {
    expect(workArea({ inMs: 1000, outMs: 3000 }, 5000)).toEqual({ startMs: 1000, endMs: 3000 });
    expect(workArea({ inMs: 4000, outMs: 9000 }, 5000)).toEqual({ startMs: 4000, endMs: 5000 });
    expect(workArea({ inMs: -200, outMs: 800 }, 5000)).toEqual({ startMs: 0, endMs: 800 });
  });

  it("does not exist until both marks are set with out after in, inside the film", () => {
    expect(workArea({ inMs: null, outMs: 3000 }, 5000)).toBeNull();
    expect(workArea({ inMs: 1000, outMs: null }, 5000)).toBeNull();
    expect(workArea({ inMs: 3000, outMs: 3000 }, 5000)).toBeNull();
    expect(workArea({ inMs: 3000, outMs: 1000 }, 5000)).toBeNull();
    expect(workArea({ inMs: 6000, outMs: 8000 }, 5000)).toBeNull();
  });

  it("plays the work area only when asked and the film otherwise", () => {
    const range = { inMs: 1000, outMs: 3000 };
    expect(playSpan(range, 5000, true)).toEqual({ startMs: 1000, endMs: 3000 });
    expect(playSpan(range, 5000, false)).toEqual(filmSpan(5000));
    expect(playSpan({ inMs: null, outMs: null }, 5000, true)).toEqual(filmSpan(5000));
  });

  it("measures and clamps spans", () => {
    expect(spanLength({ startMs: 1200, endMs: 4000 })).toBe(2800);
    expect(clampSpan({ startMs: 1000, endMs: 9000 }, 4000)).toEqual({ startMs: 1000, endMs: 4000 });
    expect(clampSpan({ startMs: 4000, endMs: 9000 }, 4000)).toBeNull();
    expect(filmSpan(-10)).toEqual({ startMs: 0, endMs: 0 });
    expect(insideSpan({ startMs: 1000, endMs: 2000 }, 2000)).toBe(true);
    expect(insideSpan({ startMs: 1000, endMs: 2000 }, 2001)).toBe(false);
  });
});

describe("where playback starts", () => {
  const span = { startMs: 1000, endMs: 3000 };

  it("plays forward from the playhead inside the span and from its start outside or at its end", () => {
    expect(playStart(span, 1500, 1, false)).toBe(1500);
    expect(playStart(span, 200, 1, false)).toBe(1000);
    expect(playStart(span, 3000, 1, false)).toBe(1000);
    expect(playStart(span, 4500, 2, true)).toBe(1000);
  });

  it("plays backwards from the playhead, from the end past it, and wraps at the start only when looping", () => {
    expect(playStart(span, 2000, -1, false)).toBe(2000);
    expect(playStart(span, 4000, -1, false)).toBe(3000);
    expect(playStart(span, 1000, -1, false)).toBeNull();
    expect(playStart(span, 1000, -2, true)).toBe(3000);
    expect(playStart(filmSpan(5000), 0, -1, false)).toBeNull();
  });
});
