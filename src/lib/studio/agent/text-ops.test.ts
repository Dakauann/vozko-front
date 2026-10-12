import { describe, expect, it } from "vitest";

import { counterIssue, counterRange, counterText, counterValueAt } from "../counter";
import { emptyVideoDocument, newOverlayClip, newShapeLayer, newTextLayer, type VideoDocument } from "../document";
import { textPathIssue } from "../text-path";
import { findClip } from "../timeline";
import { planBatch } from "./batch";
import { outlineClip } from "./outline";
import { applyVideoOperation, VIDEO_ID_FIELDS, VIDEO_OPERATIONS, videoIds, type VideoOpContext, type VideoOperation } from "./video-ops";

function film(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newOverlayClip({ ...newTextLayer("0"), curve: 0.3 }, 0, 3000), id: "title" }] },
    { id: "v2", kind: "visual", clips: [{ ...newOverlayClip(newShapeLayer("rect"), 0, 3000), id: "box" }] },
  ];
  d.durationMs = 3000;
  return d;
}

const ctx: VideoOpContext = {
  playheadMs: 0,
  magnetic: false,
  mediaType: () => null,
  sourceDuration: () => 10_000,
  captions: () => undefined,
  captionTrackName: "Legendas",
  icons: [],
  speech: () => undefined,
  loudness: () => undefined,
};

function run(ops: VideoOperation[], base: VideoDocument = film()) {
  return planBatch(base, ops, (d, op) => applyVideoOperation(d, op, ctx), VIDEO_ID_FIELDS, videoIds);
}

const title = (d: VideoDocument) => findClip(d, "title")!.clip;

describe("counter operations", () => {
  it("lists the text operations", () => {
    for (const op of ["set_counter", "remove_counter", "set_text_path", "remove_text_path"]) expect(VIDEO_OPERATIONS).toContain(op);
  });

  it("counts from one value to another with every format option", () => {
    const plan = run([{ op: "set_counter", clip_id: "title", counter_from: 0, counter_to: 10_000, count_start_ms: 200, count_ms: 1500, easing: "easeOut", decimals: 0, counter_locale: "pt-BR", prefix: "R$ ", suffix: " mil" }]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const clip = title(plan.final);
    expect(counterRange(clip)).toEqual({ from: 0, to: 10_000, startMs: 200, durationMs: 1500, easing: "easeOut" });
    expect(counterText(clip.counter!, counterValueAt(clip, 1700))).toBe("R$ 10.000 mil");
    expect(counterIssue(clip)).toBeNull();
    expect(outlineClip(clip, { detail: "brief", playheadMs: 0, selection: [], asset: () => undefined } as never).counter).toMatchObject({ from: 0, to: 10_000, shows: "R$ 10.000 mil", locale: "pt-BR" });
  });

  it("sets a still value, refuses it on an animated counter without at_ms and keys it with at_ms", () => {
    const still = run([{ op: "set_counter", clip_id: "title", counter_value: 42 }]);
    expect(still.ok && title(still.final).counter?.value).toBe(42);
    const animated: VideoOperation = { op: "animate", clip_id: "title", property: "counter", keys: [{ at_ms: 0, value: 0 }, { at_ms: 1000, value: 100 }] };
    const refused = run([animated, { op: "set_counter", clip_id: "title", counter_value: 50 }]);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toContain("at_ms");
    const keyed = run([animated, { op: "set_counter", clip_id: "title", counter_value: 50, at_ms: 500 }]);
    expect(keyed.ok && title(keyed.final).keyframes?.counter?.map((key) => key.value)).toEqual([0, 50, 100]);
  });

  it("turns the counter on when animate reaches it, and removes it with its keys", () => {
    const plan = run([
      { op: "animate", clip_id: "title", property: "counter", keys: [{ at_ms: 0, value: 0 }, { at_ms: 900, value: 500 }] },
      { op: "remove_counter", clip_id: "title" },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(title(plan.final).counter).toBeUndefined();
    expect(title(plan.final).keyframes?.counter).toBeUndefined();
  });

  it("refuses what does not fit", () => {
    const cases: [VideoOperation, string][] = [
      [{ op: "set_counter", clip_id: "box", counter_to: 5 }, "não é um texto"],
      [{ op: "set_counter", clip_id: "title", counter_value: 1, counter_to: 5 }, "não os dois"],
      [{ op: "set_counter", clip_id: "title", decimals: 5 }, "decimals"],
      [{ op: "set_counter", clip_id: "title", counter_locale: "fr-FR" as never }, "counter_locale"],
      [{ op: "set_counter", clip_id: "title", prefix: "x".repeat(20) }, "caracteres"],
      [{ op: "set_counter", clip_id: "title", counter_to: 5, count_start_ms: 2500, count_ms: 1000 }, "caber"],
      [{ op: "remove_counter", clip_id: "title" }, "não tem contador"],
    ];
    for (const [op, text] of cases) {
      const plan = run([op]);
      expect(plan.ok).toBe(false);
      if (!plan.ok) expect(plan.reason).toContain(text);
    }
  });
});

describe("text path operations", () => {
  it("puts curved text on an arc with the same bend and slides it along", () => {
    const plan = run([
      { op: "set_text_path", clip_id: "title" },
      { op: "animate", clip_id: "title", property: "pathOffset", keys: [{ at_ms: 0, value: -0.5 }, { at_ms: 2000, value: 1.5, easing: "linear" }] },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const clip = title(plan.final);
    expect(clip.textPath).toMatchObject({ shape: "arc", bend: 0.3, align: "center" });
    expect(clip.layer?.curve).toBeUndefined();
    expect(textPathIssue(clip)).toBeNull();
  });

  it("changes shape, takes a custom path and the options", () => {
    const plan = run([
      { op: "set_text_path", clip_id: "title", path_shape: "custom", path: "M0 1 C0.3 0 0.7 0 1 1", path_offset: 0, path_align: "start", upright: true, path_reverse: true },
      { op: "set_text_path", clip_id: "title", path_shape: "circle" },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(title(plan.final).textPath).toEqual({ shape: "circle", offset: 0, align: "start", upright: true, reverse: true });
  });

  it("refuses what does not fit and removes the path with its keys", () => {
    const cases: [VideoOperation, string][] = [
      [{ op: "set_text_path", clip_id: "box" }, "não é um texto"],
      [{ op: "set_text_path", clip_id: "title", path_shape: "circle", bend: 0.5 }, "bend"],
      [{ op: "set_text_path", clip_id: "title", path_shape: "arc", path: "M0 0 L1 1" }, "custom"],
      [{ op: "set_text_path", clip_id: "title", path_shape: "custom", path: "oops" }, "SVG"],
      [{ op: "set_text_path", clip_id: "title", path_offset: 9 }, "path_offset"],
      [{ op: "remove_text_path", clip_id: "title" }, "não tem texto em caminho"],
    ];
    for (const [op, text] of cases) {
      const plan = run([op]);
      expect(plan.ok).toBe(false);
      if (!plan.ok) expect(plan.reason).toContain(text);
    }
    const removed = run([{ op: "set_text_path", clip_id: "title", path_offset: 0.2 }, { op: "remove_text_path", clip_id: "title" }]);
    expect(removed.ok && title(removed.final).textPath).toBeUndefined();
  });
});
