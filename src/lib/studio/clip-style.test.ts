import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { clipHaloAt, clipStyleIssue } from "./clip-style";
import { animateClipEffect, editClipEffect, setClipStyle, toggleClipEffectKey } from "./clip-style-edit";
import { emptyVideoDocument, newMediaClip, newOverlayClip, newShapeLayer, newTextLayer, type Clip, type VideoDocument } from "./document";
import { applyLayerEffects, effectHalo } from "./effect-pixels";
import { editedEffect, effectAt, effectsKeyed, shownEffect } from "./effect-keys";
import { layerAt } from "./layer-at";
import { newEffect, type Effect, type StrokePaint } from "./layer-paint";
import { haloLayout, maskedAlpha, pictureRect, rectAlpha } from "./media-halo";
import { newMask } from "./masks";
import { visualPlan } from "./playback";
import { videoScene } from "./scene/video-scene";
import { findClip, splitClip } from "./timeline";
import { documentIssue } from "./validate";

const FIXTURE = resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_layer_styles.json");

function fixture(): VideoDocument {
  return JSON.parse(readFileSync(FIXTURE, "utf8")) as VideoDocument;
}

const glow = (patch: Partial<Effect> = {}): Effect => ({ ...newEffect("outer-glow", "glow"), ...patch });
const outline: StrokePaint = { type: "solid", color: "#ffffff", opacity: 1, width: 6, align: "outside" };

function film(clip: Partial<Clip>, kind: "video" | "text" = "video"): VideoDocument {
  const doc = emptyVideoDocument("square");
  const base = kind === "video" ? newMediaClip("video", "m", 0, 2000) : newOverlayClip(newTextLayer("Oi"), 0, 2000);
  doc.tracks = [{ id: "v", kind: "visual", clips: [{ ...base, id: "c", ...clip }] }];
  doc.durationMs = 2000;
  return doc;
}

function clipOf(doc: VideoDocument): Clip {
  return findClip(doc, "c")!.clip;
}

describe("layer styles on video documents", () => {
  it("accepts the same layer style document the backend contract test reads", () => {
    expect(documentIssue("video", fixture())).toBeNull();
  });

  it("refuses what the backend refuses", () => {
    const cases: [string, (d: VideoDocument) => void][] = [
      ["an inner glow on a video", (d) => (d.tracks[0].clips[0].effects![1].type = "inner-glow")],
      ["a centered stroke on a video", (d) => (d.tracks[0].clips[0].strokes![0].align = "center")],
      ["a dashed stroke on a video", (d) => (d.tracks[0].clips[0].strokes![0].dashArray = [2, 1])],
      ["two effects with one id", (d) => (d.tracks[0].clips[0].effects![1].id = "fx-glow")],
      ["an effect key past its range", (d) => (d.tracks[0].clips[0].effects![0].keyframes!.opacity![1].value = 1.5)],
      ["effect keys out of order", (d) => (d.tracks[0].clips[0].effects![0].keyframes!.blur![1].atMs = 0)],
      ["styles on a text clip", (d) => (d.tracks[1].clips[0].effects = d.tracks[0].clips[0].effects)],
      ["an overlay effect key off range", (d) => (d.tracks[1].clips[0].layer!.effects![0].keyframes!.spread![1].value = 500)],
      ["a shadow next to an effect list", (d) => (d.tracks[1].clips[0].layer!.shadow = { color: "#000000", blur: 4, x: 0, y: 0 })],
      ["a fill next to a fill list", (d) => (d.tracks[1].clips[0].layer!.fill = "#ffffff")],
    ];
    for (const [name, change] of cases) {
      const doc = fixture();
      change(doc);
      expect(documentIssue("video", doc), name).not.toBeNull();
    }
    expect(clipStyleIssue({ type: "audio", effects: [glow()] })).toBe("invalid");
  });

  it("resolves keyed effect values at each moment and redraws the overlay every frame", () => {
    const pulse = glow({ keyframes: { opacity: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 1000, value: 1, easing: "linear" }] } });
    expect(effectAt(pulse, 250).opacity).toBe(0.25);
    expect(effectAt(pulse, 250).keyframes).toBeUndefined();
    expect(effectsKeyed([pulse])).toBe(true);
    const doc = film({ layer: { ...newTextLayer("Oi"), effects: [pulse] } }, "text");
    expect(layerAt(clipOf(doc), 500)?.effects?.[0].opacity).toBe(0.5);
    const item = visualPlan(doc, 500)[0];
    expect(item.live).toBe(true);
    expect(videoScene(doc, [item]).nodes[0].live).toBe(true);
  });

  it("plans a halo around media clips that follows masks and keyed values", () => {
    const doc = film({ effects: [glow({ keyframes: { blur: [{ atMs: 0, value: 4, easing: "linear" }, { atMs: 1000, value: 24, easing: "linear" }] } })], strokes: [outline], masks: [newMask("ellipse", "round")] });
    const halo = clipHaloAt(clipOf(doc), 500)!;
    expect(halo.plan.effects[0].blur).toBe(14);
    expect(halo.plan.outlines).toEqual([outline]);
    expect(halo.live).toBe(true);
    const node = videoScene(doc, visualPlan(doc, 500)).nodes[0];
    expect(node.halo?.picture).toEqual({ kind: "rect", fit: "cover" });
    expect(node.halo?.masks).toHaveLength(1);
    expect(node.halo?.padPx).toBeGreaterThanOrEqual(6 + 14 * 1.5);
    expect(clipHaloAt({ type: "video", effects: [glow({ hidden: true })] }, 0)).toBeUndefined();
  });

  it("draws the halo so that the content over it equals the layer effects on the content", () => {
    const side = 32;
    const data = new Uint8ClampedArray(side * side * 4);
    for (let y = 10; y < 22; y++) for (let x = 8; x < 20; x++) data.set([200, 40, 40, 255], (y * side + x) * 4);
    const plan = { effects: [glow({ color: "#00ff00", blur: 4, spread: 2 }), { ...newEffect("drop-shadow", "s"), y: 3, blur: 2 }], outlines: [{ ...outline, width: 3 }] };
    const alpha = Float32Array.from({ length: side * side }, (_, i) => data[i * 4 + 3] / 255);
    const halo = effectHalo(alpha, side, side, plan, 1);
    const expected = Uint8ClampedArray.from(data);
    applyLayerEffects(expected, side, side, plan, 1);
    for (let i = 0; i < side * side; i++) {
      const top = data[i * 4 + 3] / 255;
      const under = halo[i * 4 + 3] / 255;
      const a = top + under * (1 - top);
      expect(Math.abs(Math.round(a * 255) - expected[i * 4 + 3])).toBeLessThanOrEqual(1);
      if (a === 0) continue;
      for (let c = 0; c < 3; c++) {
        const mixed = (data[i * 4 + c] * top + halo[i * 4 + c] * under * (1 - top)) / a;
        expect(Math.abs(mixed - expected[i * 4 + c])).toBeLessThanOrEqual(2);
      }
    }
  });

  it("lays out the silhouette of a contained picture and cuts it with masks", () => {
    const layout = haloLayout({ base: { width: 100, height: 50 }, padPx: 10 }, 2);
    expect([layout.width, layout.height, layout.pad]).toEqual([240, 140, 20]);
    expect(pictureRect("cover", { width: 10, height: 10 }, layout)).toEqual({ x: 20, y: 20, width: 200, height: 100 });
    expect(pictureRect("contain", { width: 10, height: 10 }, layout)).toEqual({ x: 70, y: 20, width: 100, height: 100 });
    const alpha = rectAlpha(layout, { x: 20.5, y: 20, width: 200, height: 100 });
    expect(alpha[30 * 240 + 20]).toBeCloseTo(0.5, 6);
    expect(alpha[30 * 240 + 21]).toBe(1);
    expect(alpha[10 * 240 + 100]).toBe(0);
    const cut = maskedAlpha(alpha, layout, [{ ...newMask("rectangle", "half"), x: 0.25, w: 0.5, h: 1 }]);
    expect(cut[70 * 240 + 60]).toBe(1);
    expect(cut[70 * 240 + 180]).toBe(0);
  });

  it("edits styles through the shared edits used by the inspector and Elo", () => {
    const doc = film({});
    const styled = setClipStyle(doc, "c", { effects: [glow({ id: "fx" })], strokes: [outline] });
    if (!styled.ok) throw new Error(styled.reason);
    expect(clipOf(styled.document).effects?.[0].id).toBe("fx");
    expect(setClipStyle(doc, "c", { fills: [{ type: "solid", color: "#ffffff", opacity: 1 }] })).toEqual({ ok: false, reason: "noStyle" });
    expect(setClipStyle(doc, "c", { effects: [newEffect("inner-glow", "in")] })).toEqual({ ok: false, reason: "invalid" });
    const keyed = toggleClipEffectKey(styled.document, "c", "fx", "opacity", 400);
    expect(keyed.ok && clipOf(keyed.document).effects?.[0].keyframes?.opacity).toEqual([{ atMs: 400, value: 0.75, easing: "linear" }]);
    if (!keyed.ok) return;
    expect(editClipEffect(keyed.document, "c", "fx", { opacity: 0.2 }, null)).toEqual({ ok: false, reason: "animated" });
    const twice = editClipEffect(keyed.document, "c", "fx", { opacity: 0.2, blur: 40 }, 900);
    expect(twice.ok && clipOf(twice.document).effects?.[0].keyframes?.opacity?.map((key) => [key.atMs, key.value])).toEqual([
      [400, 0.75],
      [900, 0.2],
    ]);
    expect(twice.ok && clipOf(twice.document).effects?.[0].blur).toBe(40);
    const lane = animateClipEffect(styled.document, "c", "fx", "spread", [{ atMs: 0, value: 0, easing: "easeOut" }, { atMs: 800, value: 12, easing: "linear" }]);
    expect(lane.ok && clipOf(lane.document).effects?.[0].keyframes?.spread).toHaveLength(2);
    expect(animateClipEffect(styled.document, "c", "fx", "spread", [{ atMs: 2500, value: 0, easing: "linear" }])).toEqual({ ok: false, reason: "outside" });
    expect(toggleClipEffectKey(styled.document, "c", "missing", "blur", 0)).toEqual({ ok: false, reason: "effectMissing" });
    const overlay = setClipStyle(film({}, "text"), "c", { fills: [{ type: "solid", color: "#ff0000", opacity: 1 }], effects: [newEffect("inner-shadow", "in")] });
    expect(overlay.ok && clipOf(overlay.document).layer?.fills).toHaveLength(1);
    expect(overlay.ok && clipOf(overlay.document).layer?.fill).toBeUndefined();
  });

  it("turns an inspector change on a keyed value into a key and keeps the others", () => {
    const stored = glow({ keyframes: { blur: [{ atMs: 0, value: 4, easing: "linear" }, { atMs: 1000, value: 24, easing: "linear" }] } });
    const shown = shownEffect(stored, 500);
    expect(shown.blur).toBe(14);
    const next = editedEffect(stored, shown, { ...shown, blur: 30, color: "#ff0000" }, 500)!;
    expect(next.keyframes?.blur?.map((key) => [key.atMs, key.value])).toEqual([
      [0, 4],
      [500, 30],
      [1000, 24],
    ]);
    expect(next.color).toBe("#ff0000");
    expect(next.blur).toBe(stored.blur);
    expect(editedEffect(stored, shown, { ...shown, blur: 30 }, null)).toBeNull();
  });

  it("carries effect keys into the right piece of a split", () => {
    const keyed = glow({ keyframes: { opacity: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 1000, value: 1, easing: "linear" }] } });
    const media = splitClip(film({ effects: [keyed] }), "c", 600);
    expect(findClip(media.document, media.clipId!)!.clip.effects?.[0].keyframes?.opacity?.map((key) => key.atMs)).toEqual([-600, 400]);
    const text = splitClip(film({ layer: { ...newShapeLayer("rect"), effects: [keyed] } }, "text"), "c", 600);
    expect(findClip(text.document, text.clipId!)!.clip.layer?.effects?.[0].keyframes?.opacity?.map((key) => key.atMs)).toEqual([-600, 400]);
    expect(documentIssue("video", media.document)).toBeNull();
  });
});
