import { describe, expect, it } from "vitest";

import {
  anchoredScroll,
  clampZoom,
  contentWidthPx,
  envelopePoints,
  levelFromY,
  followScroll,
  laneBoxes,
  laneIndexAt,
  laneTops,
  formatSmpte,
  stackTops,
  focusView,
  overviewMs,
  overviewToMs,
  overviewWindow,
  rangeView,
  scrollToCenter,
  steppedSpan,
  visibleSpan,
  laneOrder,
  fitZoom,
  formatRulerLabel,
  formatTimecode,
  idsInMarquee,
  MAX_PX_PER_SECOND,
  MIN_PX_PER_SECOND,
  msToPx,
  normalizedRect,
  pxToMs,
  rulerStep,
  rulerTicks,
  sliderToZoom,
  snapThresholdMs,
  toggledSelection,
  zoomBy,
  zoomToSlider,
} from "./timeline-view";

describe("timeline view math", () => {
  it("maps zoom to a log slider and back", () => {
    expect(sliderToZoom(0)).toBe(MIN_PX_PER_SECOND);
    expect(sliderToZoom(1)).toBeCloseTo(MAX_PX_PER_SECOND);
    expect(sliderToZoom(zoomToSlider(100))).toBeCloseTo(100);
    expect(zoomToSlider(Math.sqrt(MIN_PX_PER_SECOND * MAX_PX_PER_SECOND))).toBeCloseTo(0.5);
  });

  it("zooms in steps and clamps", () => {
    expect(zoomBy(100, 1)).toBeCloseTo(125);
    expect(zoomBy(100, -1)).toBeCloseTo(80);
    expect(zoomBy(MAX_PX_PER_SECOND, 3)).toBe(MAX_PX_PER_SECOND);
    expect(clampZoom(Number.NaN)).toBeGreaterThan(0);
  });

  it("converts between time and pixels", () => {
    expect(msToPx(1500, 100)).toBe(150);
    expect(pxToMs(150, 100)).toBe(1500);
    expect(snapThresholdMs(100, 8)).toBe(80);
  });

  it("keeps the anchor time under the same viewport pixel after zooming", () => {
    const anchorMs = 4000;
    const scroll = anchoredScroll(anchorMs, 200, 120);
    expect(msToPx(anchorMs, 120) - scroll).toBe(200);
    expect(anchoredScroll(500, 900, 50)).toBe(0);
  });

  it("fits the content into the viewport", () => {
    expect(fitZoom(10_000, 1000)).toBe(100);
    expect(fitZoom(0, 1000)).toBeGreaterThan(0);
  });

  it("chooses ruler steps that leave room for labels", () => {
    expect(rulerStep(100)).toEqual({ majorMs: 1000, minorMs: 500 });
    expect(rulerStep(10).majorMs).toBe(10_000);
    expect(rulerStep(600).majorMs).toBe(200);
    const ticks = rulerTicks(100, 0, 2000);
    expect(ticks.map((t) => t.ms)).toEqual([0, 500, 1000, 1500, 2000]);
    expect(ticks.filter((t) => t.major).map((t) => t.ms)).toEqual([0, 1000, 2000]);
  });

  it("formats timecodes with frames", () => {
    expect(formatTimecode(0)).toBe("0:00.00");
    expect(formatTimecode(61_500)).toBe("1:01.15");
    expect(formatRulerLabel(2000, 1000)).toBe("0:02");
    expect(formatRulerLabel(2500, 500)).toBe("0:02.5");
  });

  it("selects clips under a marquee", () => {
    const boxes = [
      { id: "a", rect: { left: 0, top: 0, right: 100, bottom: 40 } },
      { id: "b", rect: { left: 150, top: 0, right: 250, bottom: 40 } },
      { id: "c", rect: { left: 0, top: 50, right: 100, bottom: 90 } },
    ];
    expect(idsInMarquee(boxes, normalizedRect(120, 45, 60, 10))).toEqual(["a"]);
    expect(idsInMarquee(boxes, normalizedRect(50, 20, 200, 60))).toEqual(["a", "b", "c"]);
  });

  it("toggles additive selection", () => {
    expect(toggledSelection(["a"], "b", false)).toEqual(["b"]);
    expect(toggledSelection(["a"], "b", true)).toEqual(["a", "b"]);
    expect(toggledSelection(["a", "b"], "a", true)).toEqual(["b"]);
  });
});

describe("lanes", () => {
  const tracks = [
    { id: "v1", kind: "visual" as const, clips: [{ id: "a", startMs: 0, durationMs: 1000 }] },
    { id: "a1", kind: "audio" as const, clips: [{ id: "m", startMs: 500, durationMs: 1000 }] },
    { id: "v2", kind: "visual" as const, clips: [] },
  ];

  it("shows the top visual track first and audio below", () => {
    expect(laneOrder(tracks).map((t) => t.id)).toEqual(["v2", "v1", "a1"]);
  });

  it("lays clips out on their lanes", () => {
    expect(laneBoxes(tracks, 100, 50)).toEqual([
      { id: "a", rect: { left: 0, right: 100, top: 50, bottom: 100 } },
      { id: "m", rect: { left: 50, right: 150, top: 100, bottom: 150 } },
    ]);
  });

  it("leaves room after the content and fills the viewport", () => {
    expect(contentWidthPx(0, 90_000, 10, 1000)).toBe(1000);
    expect(contentWidthPx(60_000, 90_000, 100, 500)).toBe(7620);
    expect(contentWidthPx(89_000, 90_000, 10, 100)).toBe(1020);
  });

  it("follows the playhead when it leaves the view", () => {
    expect(followScroll(500, 0, 1000)).toBeNull();
    expect(followScroll(990, 0, 1000)).toBe(890);
    expect(followScroll(100, 400, 1000)).toBe(0);
  });
});

describe("clip envelope", () => {
  it("draws the level line with its fade ramps", () => {
    expect(envelopePoints({ durationMs: 4000, fadeInMs: 1000, fadeOutMs: 0 }, 400, 40, 0.5)).toEqual([
      [0, 40],
      [100, 20],
      [400, 20],
      [400, 20],
    ]);
  });

  it("reads a level from the pointer height", () => {
    expect(levelFromY(10, 40, 2)).toBe(1.5);
    expect(levelFromY(-5, 40, 2)).toBe(2);
    expect(levelFromY(90, 40, 2)).toBe(0);
  });
});

describe("dense lanes", () => {
  const tracks = [
    { id: "v1", kind: "visual" as const, clips: [{ id: "a", startMs: 0, durationMs: 1000 }] },
    { id: "a1", kind: "audio" as const, clips: [{ id: "m", startMs: 0, durationMs: 1000 }] },
  ];
  const height = (kind: "visual" | "audio") => (kind === "visual" ? 56 : 44);

  it("stacks lanes of different heights", () => {
    expect(laneTops(tracks, height)).toEqual([0, 56]);
    expect(laneIndexAt(tracks, height, 55)).toBe(0);
    expect(laneIndexAt(tracks, height, 60)).toBe(1);
    expect(laneIndexAt(tracks, height, 101)).toBe(-1);
    expect(laneBoxes(tracks, 100, height)[1].rect).toEqual({ left: 0, right: 100, top: 56, bottom: 100 });
  });
});

describe("timecode and visible spans", () => {
  it("formats hours, minutes, seconds and frames", () => {
    expect(formatSmpte(0)).toBe("00:00:00:00");
    expect(formatSmpte(61_500)).toBe("00:01:01:15");
    expect(formatSmpte(3_600_000 + 33)).toBe("01:00:00:01");
  });

  it("clips a clip to the visible part of the scroller", () => {
    expect(visibleSpan(100, 500, 300, 200)).toEqual({ fromPx: 200, toPx: 400 });
    expect(visibleSpan(100, 500, 0, 50)).toBeNull();
  });

  it("widens a visible span to whole steps so small scrolls keep the same span", () => {
    expect(steppedSpan({ fromPx: 130, toPx: 370 }, 100, 500)).toEqual({ fromPx: 100, toPx: 400 });
    expect(steppedSpan({ fromPx: 160, toPx: 399 }, 100, 500)).toEqual({ fromPx: 100, toPx: 400 });
    expect(steppedSpan({ fromPx: 420, toPx: 480 }, 100, 450)).toEqual({ fromPx: 400, toPx: 450 });
    expect(steppedSpan(null, 100, 500)).toBeNull();
    expect(visibleSpan(100, 500, 0, 50, 60)).toEqual({ fromPx: 0, toPx: 10 });
  });
});

describe("overview strip", () => {
  it("maps the visible range onto the whole project", () => {
    expect(overviewMs(10_000, 4000)).toBe(10_000);
    expect(overviewMs(2000, 4000)).toBe(4000);
    expect(overviewWindow(200, 400, 100, 1000, 10_000)).toEqual({ left: 200, width: 400 });
    expect(overviewWindow(950, 400, 100, 1000, 10_000)).toEqual({ left: 950, width: 50 });
  });

  it("turns overview positions into time and scroll", () => {
    expect(overviewToMs(250, 1000, 10_000)).toBe(2500);
    expect(overviewToMs(-5, 1000, 10_000)).toBe(0);
    expect(scrollToCenter(5000, 400, 100)).toBe(300);
    expect(rangeView(2000, 6000, 800)).toEqual({ pxPerSecond: 200, scrollLeft: 400 });
  });
});

describe("focus view", () => {
  it("frames the clip with a margin", () => {
    const view = focusView(10_000, 5000, 1000);
    expect(view.pxPerSecond).toBeCloseTo(1000 / 5.8);
    expect(view.scrollLeft).toBeCloseTo((9600 * view.pxPerSecond) / 1000);
    expect(focusView(100, 1000, 1000).scrollLeft).toBe(0);
  });
});

describe("stackTops", () => {
  it("stacks heights from zero", () => {
    expect(stackTops([56, 18, 44])).toEqual([0, 56, 74]);
    expect(stackTops([])).toEqual([]);
  });
});
