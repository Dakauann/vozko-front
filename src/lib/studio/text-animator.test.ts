import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newOverlayClip, newTextLayer, type Clip, type VideoDocument } from "./document";
import { splitClip } from "./timeline";
import { textMotionOf, textUnitFrames, type LaidLine, type TextMotion } from "./text-animation";
import {
  animatorKeyTimes,
  newRangeSelector,
  newTextUnitAnimator,
  newWigglySelector,
  presetFits,
  reselected,
  reunited,
  splitTextAnimators,
  TEXT_ANIMATOR_PRESETS,
  textAnimatorPreset,
  withProperty,
} from "./text-animator";
import { animatorFrameAt, type AnimatorFrame, type RangeSelector, type TextUnitAnimator } from "./text-selectors";
import { documentIssue } from "./validate";

const word = (left: number, text: string): LaidLine["chars"] => [...text].map((char, i) => ({ char, left: left + i * 10, right: left + (i + 1) * 10 }));

const layout: LaidLine[] = [
  { top: 10, height: 20, chars: [...word(0, "ab"), ...word(20, " "), ...word(30, "cd")] },
  { top: 30, height: 20, chars: word(10, "ef") },
];

const range = (patch: Partial<RangeSelector> = {}): RangeSelector => ({ ...newRangeSelector(1), ...patch });

function frame(animator: Partial<TextUnitAnimator>, localMs = 0): AnimatorFrame {
  return animatorFrameAt({ id: "a", unit: "char", properties: {}, selector: range(), ...animator }, localMs);
}

function motion(animators: AnimatorFrame[], extra: Partial<TextMotion> = {}): TextMotion {
  return { animators, localMs: 0, durationMs: 2000, ...extra };
}

function doc(clip: Partial<Clip> = {}): VideoDocument {
  const d = emptyVideoDocument("square");
  d.tracks = [{ id: "t", kind: "visual", clips: [{ ...newOverlayClip({ ...newTextLayer("Oferta de hoje"), fill: "#ffffff" }, 0, 2000), id: "o", ...clip }] }];
  d.durationMs = 2000;
  return d;
}

const text = (d: VideoDocument) => d.tracks[0].clips[0];

describe("animator frames on the text", () => {
  it("hides the letters a square range selects and leaves the rest", () => {
    const frames = textUnitFrames(motion([frame({ properties: { opacity: 0 }, selector: range({ end: 50 }) })]), layout, 100, 60);
    expect(frames).toHaveLength(6);
    expect(frames.map((f) => f.look.opacity)).toEqual([0, 0, 0, 1, 1, 1]);
  });

  it("turns and moves the selected units", () => {
    const [first] = textUnitFrames(motion([frame({ properties: { rotation: 45, x: 8, y: -4 } })]), layout, 100, 60);
    const lift = 20 - (first.tile.y + first.tile.height / 2);
    expect(first.look.rotation).toBe(45);
    expect(first.look.dx).toBeCloseTo(8 + lift * Math.SQRT1_2);
    expect(first.look.dy).toBeCloseTo(-4 + lift - lift * Math.SQRT1_2);
  });

  it("scales the letters of a word around the drawn word when another animator cuts by letter", () => {
    const frames = textUnitFrames(motion([frame({ unit: "word", properties: { scale: 200 } }), frame({ properties: { opacity: 100 } })]), layout, 100, 60);
    expect(frames).toHaveLength(6);
    const [a, b] = frames;
    expect(a.look.scale).toBe(2);
    const wordCenter = (0 + 20) / 2;
    expect(a.tile.x + a.tile.width / 2 + a.look.dx - wordCenter).toBeCloseTo(2 * (a.tile.x + a.tile.width / 2 - wordCenter));
    expect(b.tile.x + b.tile.width / 2 + b.look.dx - wordCenter).toBeCloseTo(2 * (b.tile.x + b.tile.width / 2 - wordCenter));
  });

  it("opens the spacing cumulatively and keeps a centered line centered", () => {
    const tracked = frame({ properties: { tracking: 10 } });
    const left = textUnitFrames(motion([tracked]), layout, 100, 60);
    expect(left.map((f) => f.look.dx)).toEqual([0, 10, 20, 30, 0, 10]);
    const centered = textUnitFrames(motion([tracked]), layout, 100, 60, "center");
    expect(centered.map((f) => f.look.dx)).toEqual([-15, -5, 5, 15, -5, 5]);
  });

  it("carries the color share of each animator", () => {
    const frames = textUnitFrames(motion([frame({ properties: { opacity: 50 } }), frame({ properties: { fill: "#ff0000" }, selector: range({ end: 50 }) })]), layout, 100, 60);
    expect(frames[0].look.tints).toEqual([0, 1]);
    expect(frames[5].look.tints).toBeUndefined();
  });

  it("combines with the entrance by cutting at the finest unit", () => {
    const enter = { unit: "word" as const, style: "fade" as const, durationMs: 200, staggerMs: 100, easing: "linear" as const };
    const frames = textUnitFrames(motion([frame({ properties: { y: 10 }, selector: range({ end: 50 }) })], { in: enter, localMs: 100 }), layout, 100, 60);
    expect(frames).toHaveLength(6);
    expect(frames[0].look).toMatchObject({ opacity: 0.5, dy: 10 });
    expect(frames[3].look).toMatchObject({ opacity: 0, dy: 0 });
  });

  it("animates a text without units as one piece", () => {
    const frames = textUnitFrames(motion([frame({ properties: { opacity: 0 } })]), [], 100, 60);
    expect(frames).toEqual([{ tile: { x: 0, y: 0, width: 100, height: 60 }, look: expect.objectContaining({ opacity: 0 }) }]);
  });

  it("reads the animators of a clip at a moment", () => {
    const animator = newTextUnitAnimator("char", { opacity: 0 }, range());
    const clip = { ...newOverlayClip(newTextLayer("Oi"), 0, 2000), textAnimators: [animator] };
    expect(textMotionOf(clip, 300)).toEqual({ animators: [animatorFrameAt(animator, 300)], localMs: 300, durationMs: 2000 });
  });
});

describe("text animators in the document", () => {
  it("accepts every preset on a plain text", () => {
    const d = doc();
    const context = { durationMs: 2000, fontPx: 86, layer: text(d).layer! };
    text(d).textAnimators = TEXT_ANIMATOR_PRESETS.map((id) => textAnimatorPreset(id, context, 5)!);
    expect(documentIssue("video", d)).toBeNull();
  });

  it("keeps preset keys inside the clip and refuses a color sweep on a gradient", () => {
    const d = doc();
    const context = { durationMs: 600, fontPx: 86, layer: text(d).layer! };
    for (const id of TEXT_ANIMATOR_PRESETS) {
      expect(animatorKeyTimes([textAnimatorPreset(id, context, 5)!]).every((at) => at >= 0 && at <= 600)).toBe(true);
    }
    const gradient = { ...text(d).layer!, gradient: { kind: "linear" as const, from: "#ff0000", to: "#0000ff", angle: 0 } };
    expect(presetFits("colorSweep", gradient)).toBe(false);
    expect(textAnimatorPreset("colorSweep", { ...context, layer: gradient })).toBeNull();
  });

  it("accepts the same document the backend contract test reads", () => {
    const raw = JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_text_animators.json"), "utf8"));
    expect(documentIssue("video", raw)).toBeNull();
  });

  const one = (patch: Partial<TextUnitAnimator>): TextUnitAnimator => ({ ...newTextUnitAnimator("char", { opacity: 0 }, range()), id: "anim-1", ...patch });

  it.each([
    ["animators on a video", (d: VideoDocument) => (d.tracks[0].clips[0] = { ...d.tracks[0].clips[0], layer: { ...text(d).layer!, type: "shape", shape: "rect" }, textAnimators: [one({})] }), "invalid"],
    ["an unknown order", (d: VideoDocument) => (text(d).textAnimators = [one({ selector: range({ order: "spiral" as never }) })]), "unknown"],
    ["a start past 100 percent", (d: VideoDocument) => (text(d).textAnimators = [one({ selector: range({ start: 120 }) })]), "out_of_range"],
    ["a range without a start", (d: VideoDocument) => (text(d).textAnimators = [one({ selector: { ...range(), start: undefined as never } })]), "out_of_range"],
    ["a wiggly with range fields", (d: VideoDocument) => (text(d).textAnimators = [one({ selector: { ...newWigglySelector(1), order: "forward" } as never })]), "invalid"],
    ["a range with a loop", (d: VideoDocument) => (text(d).textAnimators = [one({ selector: { ...range(), loopMs: 1000 } as never })]), "invalid"],
    ["a fractional loop", (d: VideoDocument) => (text(d).textAnimators = [one({ selector: { ...newWigglySelector(1), loopMs: 1000.5 } })]), "invalid"],
    ["a seed below zero", (d: VideoDocument) => (text(d).textAnimators = [one({ selector: range({ seed: -1 }) })]), "out_of_range"],
    ["a short color", (d: VideoDocument) => (text(d).textAnimators = [one({ properties: { fill: "#fff" } })]), "invalid"],
    ["a stroke color on a text without stroke", (d: VideoDocument) => (text(d).textAnimators = [one({ properties: { stroke: "#ff0000" } })]), "invalid"],
    ["a scale past the limit", (d: VideoDocument) => (text(d).textAnimators = [one({ properties: { scale: 5000 } })]), "out_of_range"],
    ["a repeated id", (d: VideoDocument) => (text(d).textAnimators = [one({}), one({})]), "invalid"],
    ["an offset key on a wiggly", (d: VideoDocument) => (text(d).textAnimators = [one({ selector: newWigglySelector(1), keyframes: { offset: [{ atMs: 0, value: 0, easing: "linear" }] } })]), "invalid"],
    ["an amount key past the limit", (d: VideoDocument) => (text(d).textAnimators = [one({ keyframes: { amount: [{ atMs: 0, value: 300, easing: "linear" }] } })]), "out_of_range"],
    ["an unknown property", (d: VideoDocument) => (text(d).textAnimators = [one({ properties: { skew: 10 } as never })]), "invalid"],
  ])("refuses %s", (_, change, code) => {
    const d = doc();
    change(d);
    expect(documentIssue("video", d)?.code).toBe(code);
  });
});

describe("editing animators", () => {
  it("switches the selector kind with fresh defaults and drops keys that belonged to the old one", () => {
    const keyed = { ...newTextUnitAnimator("char", { opacity: 0 }, range({ seed: 9 })), keyframes: { offset: [{ atMs: 0, value: 0, easing: "linear" as const }] } };
    const shaken = reselected(keyed, "wiggly");
    expect(shaken.selector).toEqual(newWigglySelector(9));
    expect(shaken.keyframes).toBeUndefined();
  });

  it("resets the window and its keys when the units change", () => {
    const keyed = { ...newTextUnitAnimator("char", { opacity: 0 }, range({ start: 20, end: 80 })), keyframes: { start: [{ atMs: 0, value: 20, easing: "linear" as const }], amount: [{ atMs: 0, value: 50, easing: "linear" as const }] } };
    const counted = reunited(keyed, "index");
    expect(counted.selector).toMatchObject({ units: "index", start: 0, end: 1, offset: 0 });
    expect(Object.keys(counted.keyframes ?? {})).toEqual(["amount"]);
  });

  it("adds and removes properties", () => {
    const animator = withProperty(newTextUnitAnimator("char", { opacity: 0 }), "x", 12);
    expect(animator.properties).toEqual({ opacity: 0, x: 12 });
    expect(withProperty(animator, "opacity", null).properties).toEqual({ x: 12 });
  });

  it("shifts keys and carries the wiggle clock when a clip is split", () => {
    const list = splitTextAnimators([{ ...newTextUnitAnimator(), keyframes: { offset: [{ atMs: 800, value: 0, easing: "linear" }] } }, newTextUnitAnimator("char", { x: 4 }, newWigglySelector(2))], 500);
    expect(list[0].keyframes?.offset?.[0].atMs).toBe(300);
    expect(list[1].selector).toMatchObject({ kind: "wiggly", offsetMs: 500 });
    const d = doc({ textAnimators: [newTextUnitAnimator("char", { x: 4 }, newWigglySelector(2))] });
    const split = splitClip(d, "o", 600);
    const right = split.document.tracks[0].clips.find((clip) => clip.id === split.clipId)!;
    expect(right.textAnimators?.[0].selector).toMatchObject({ offsetMs: 600 });
    expect(documentIssue("video", split.document)).toBeNull();
  });
});
