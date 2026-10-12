import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type VideoDocument } from "./document";
import { defaultTextAnimator, flowsInLines, restyledAnimator, reunitedAnimator, textMotionOf, textMotionSettled, textUnitCount, textUnitFrames, textUnitLook, textUnitTiles, type LaidLine, type TextAnimator } from "./text-animation";
import { documentIssue } from "./validate";

const word = (left: number, text: string): LaidLine["chars"] =>
  [...text].map((char, i) => ({ char, left: left + i * 10, right: left + (i + 1) * 10 }));

const layout: LaidLine[] = [
  { top: 10, height: 20, chars: [...word(0, "ab"), ...word(20, " "), ...word(30, "cd")] },
  { top: 30, height: 20, chars: word(10, "ef") },
];

describe("text units", () => {
  it("counts letters, words and lines", () => {
    expect(textUnitCount(layout, "char")).toBe(6);
    expect(textUnitCount(layout, "word")).toBe(3);
    expect(textUnitCount(layout, "line")).toBe(2);
  });

  it("tiles the whole raster so the settled text is unchanged", () => {
    for (const unit of ["char", "word", "line"] as const) {
      const tiles = textUnitTiles(layout, unit, 100, 60);
      const area = tiles.reduce((sum, tile) => sum + tile.width * tile.height, 0);
      expect(area).toBeCloseTo(6000);
    }
    expect(textUnitTiles(layout, "line", 100, 60)).toEqual([
      { x: 0, y: 0, width: 100, height: 30 },
      { x: 0, y: 30, width: 100, height: 30 },
    ]);
    const words = textUnitTiles(layout, "word", 100, 60);
    expect(words[0]).toEqual({ x: 0, y: 0, width: 25, height: 30 });
    expect(words[1]).toEqual({ x: 25, y: 0, width: 75, height: 30 });
  });
});

describe("unit looks", () => {
  const rise: TextAnimator = { unit: "word", style: "rise", durationMs: 400, staggerMs: 100, easing: "linear" };
  const size = { width: 40, height: 20 };

  it("starts each unit after the ones before it and settles it in place", () => {
    expect(textUnitLook({ in: rise }, 0, 3, 0, 2000, size)).toMatchObject({ opacity: 0 });
    expect(textUnitLook({ in: rise }, 1, 3, 300, 2000, size).opacity).toBeCloseTo(0.5);
    expect(textUnitLook({ in: rise }, 1, 3, 300, 2000, size).dy).toBeCloseTo(6);
    expect(textUnitLook({ in: rise }, 2, 3, 1000, 2000, size)).toMatchObject({ opacity: 1, dy: 0, dx: 0, scale: 1 });
  });

  it("leaves in the same order before the clip ends", () => {
    const fade: TextAnimator = { unit: "word", style: "fade", durationMs: 200, staggerMs: 100, easing: "linear" };
    expect(textUnitLook({ out: fade }, 0, 3, 1600, 2000, size).opacity).toBe(1);
    expect(textUnitLook({ out: fade }, 0, 3, 1700, 2000, size).opacity).toBeCloseTo(0.5);
    expect(textUnitLook({ out: fade }, 2, 3, 2000, 2000, size).opacity).toBe(0);
  });

  it("types letters one by one and pops words with overshoot", () => {
    const typing: TextAnimator = { unit: "char", style: "typewriter", durationMs: 60, staggerMs: 60, easing: "linear" };
    expect(textUnitLook({ in: typing }, 2, 5, 119, 2000, size).opacity).toBe(0);
    expect(textUnitLook({ in: typing }, 2, 5, 120, 2000, size).opacity).toBe(1);
    const pop = defaultTextAnimator("word", "pop");
    expect(pop.easing).toBe("backOut");
    const peak = Math.max(...Array.from({ length: 50 }, (_, i) => textUnitLook({ in: pop }, 0, 1, i * 10, 2000, size).scale));
    expect(peak).toBeGreaterThan(1);
  });
});

function doc(): VideoDocument {
  const d = emptyVideoDocument("square");
  d.tracks = [
    { id: "v", kind: "visual", clips: [{ ...newMediaClip("video", "vid", 0, 2000), id: "clip" }] },
    { id: "t", kind: "visual", clips: [{ ...newOverlayClip(newTextLayer("Oferta de hoje"), 0, 2000), id: "o" }] },
  ];
  d.durationMs = 2000;
  return d;
}

describe("text animation in the document", () => {
  it("accepts an animated text like the backend", () => {
    const d = doc();
    d.tracks[1].clips[0].textIn = defaultTextAnimator("word", "rise");
    d.tracks[1].clips[0].textOut = defaultTextAnimator("char", "fade");
    expect(documentIssue("video", d)).toBeNull();
  });

  it("animates a curved text as one piece", () => {
    const d = doc();
    d.tracks[1].clips[0].layer = { ...d.tracks[1].clips[0].layer!, curve: 0.3 };
    d.tracks[1].clips[0].textIn = defaultTextAnimator("word", "fade");
    expect(documentIssue("video", d)).toBeNull();
    expect(flowsInLines(d.tracks[1].clips[0].layer!)).toBe(false);
    const frames = textUnitFrames({ in: d.tracks[1].clips[0].textIn, localMs: 0, durationMs: 2000 }, [], 100, 60);
    expect(frames).toEqual([{ tile: { x: 0, y: 0, width: 100, height: 60 }, look: expect.objectContaining({ opacity: 0 }) }]);
  });

  it.each([
    ["text animation on a video", (d: VideoDocument) => (d.tracks[0].clips[0].textIn = defaultTextAnimator("word", "fade")), "invalid"],
    ["an unknown style", (d: VideoDocument) => (d.tracks[1].clips[0].textIn = { ...defaultTextAnimator("word", "fade"), style: "spin" as never }), "unknown"],
    ["a stagger past the limit", (d: VideoDocument) => (d.tracks[1].clips[0].textIn = { ...defaultTextAnimator("word", "fade"), staggerMs: 5000 }), "out_of_range"],
  ])("refuses %s", (_, change, code) => {
    const d = doc();
    change(d);
    expect(documentIssue("video", d)).toEqual({ field: "document.tracks", code });
  });
});

describe("choosing an animation by hand", () => {
  it("starts a typewriter by letter and other styles by word", () => {
    expect(restyledAnimator(undefined, "typewriter").unit).toBe("char");
    expect(restyledAnimator(undefined, "rise")).toEqual(defaultTextAnimator("word", "rise"));
  });

  it("keeps the unit when the style changes and the curve when the unit changes", () => {
    const custom: TextAnimator = { ...defaultTextAnimator("line", "fade"), easing: "spring" };
    expect(restyledAnimator(custom, "pop")).toEqual(defaultTextAnimator("line", "pop"));
    expect(reunitedAnimator(custom, "char")).toEqual({ ...defaultTextAnimator("char", "fade"), easing: "spring" });
  });
});

describe("text unit frames", () => {
  const enter: TextAnimator = { unit: "word", style: "fade", durationMs: 200, staggerMs: 100, easing: "linear" };
  const leave: TextAnimator = { unit: "line", style: "fade", durationMs: 200, staggerMs: 100, easing: "linear" };

  it("cuts the text by the side that is playing when the two sides use different units", () => {
    expect(textUnitFrames({ in: enter, out: leave, localMs: 100, durationMs: 2000 }, layout, 100, 60)).toHaveLength(3);
    expect(textUnitFrames({ in: enter, out: leave, localMs: 1750, durationMs: 2000 }, layout, 100, 60)).toHaveLength(2);
  });

  it("knows when every unit has settled", () => {
    expect(textMotionSettled(textUnitFrames({ in: enter, localMs: 1000, durationMs: 2000 }, layout, 100, 60))).toBe(true);
    expect(textMotionSettled(textUnitFrames({ in: enter, localMs: 150, durationMs: 2000 }, layout, 100, 60))).toBe(false);
  });

  it("reads the motion of a clip at a moment", () => {
    const clip = { ...newOverlayClip(newTextLayer("Oi"), 0, 2000), textIn: enter };
    expect(textMotionOf(clip, 300)).toEqual({ in: enter, localMs: 300, durationMs: 2000 });
    expect(textMotionOf({ ...clip, textIn: undefined }, 300)).toBeUndefined();
  });
});
