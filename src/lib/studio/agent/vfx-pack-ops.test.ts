import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "../document";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { applyVideoOperation, VIDEO_ID_FIELDS, videoIds, type VideoOpContext, type VideoOperation } from "./video-ops";

function film(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", "m-a", 0, 3000), id: "a" }] },
    { id: "au", kind: "audio", clips: [{ ...newMediaClip("audio", "m-s", 0, 3000), id: "s" }] },
  ];
  d.durationMs = 3000;
  return d;
}

const ctx: VideoOpContext = {
  playheadMs: 400,
  magnetic: false,
  mediaType: () => null,
  sourceDuration: () => 10_000,
  captions: () => undefined,
  captionTrackName: "Legendas",
  icons: [],
  speech: () => undefined,
  loudness: () => undefined,
};

function run(ops: VideoOperation[]) {
  return planBatch(film(), ops, (d, op) => applyVideoOperation(d, op, ctx), VIDEO_ID_FIELDS, videoIds);
}

function reason(ops: VideoOperation[]): string {
  const plan = run(ops);
  if (plan.ok) throw new Error("expected a refusal");
  return plan.reason;
}

describe("Elo and the effects packs", () => {
  it("adds every new effect kind through the same add_vfx", () => {
    const plan = run([
      { op: "add_vfx", clip_id: "a", vfx_kind: "twirl", vfx_params: { angle: 400, size: 0.7 } },
      { op: "add_vfx", clip_id: "a", vfx_kind: "cornerPin", vfx_params: { topLeftX: 0.1 } },
      { op: "add_vfx", clip_id: "a", vfx_kind: "echo", vfx_params: { count: 5, delay: 60 } },
      { op: "add_effect_clip", vfx_kind: "fractalNoise", vfx_params: { size: 80 } },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(findClip(plan.final, "a")?.clip.vfx?.map((vfx) => vfx.kind)).toEqual(["twirl", "cornerPin", "echo"]);
    expect(documentIssue("video", plan.final)).toBeNull();
  });

  it("asks for the sound track of a visualizer and names the audio tracks", () => {
    expect(reason([{ op: "add_vfx", clip_id: "a", vfx_kind: "audioSpectrum" }])).toBe("audioSpectrum precisa de vfx_track_id, a faixa de áudio que ele mostra (au)");
    expect(reason([{ op: "add_vfx", clip_id: "a", vfx_kind: "audioWaveform", vfx_track_id: "v1" }])).toBe("v1 não é uma faixa de áudio dessa linha do tempo; use au");
    const plan = run([{ op: "add_effect_clip", vfx_kind: "audioWaveform", vfx_track_id: "au", vfx_params: { window: 1500 } }]);
    expect(plan.ok && documentIssue("video", plan.final)).toBeNull();
  });

  it("refuses an echo on an effect clip and a track on an effect that does not listen", () => {
    expect(reason([{ op: "add_effect_clip", vfx_kind: "echo" }])).toBe("echo repete o próprio clipe em instantes anteriores e não vale num clipe de efeito; ponha o echo no clipe que se move");
    expect(reason([{ op: "add_vfx", clip_id: "a", vfx_kind: "glow", vfx_track_id: "au" }])).toBe("vfx_track_id vale só para audioSpectrum e audioWaveform, não para glow");
  });

  it("explains the range of a value with what it means", () => {
    expect(reason([{ op: "add_vfx", clip_id: "a", vfx_kind: "bulge", vfx_params: { height: 3 } }])).toBe("height de bulge vai de -1 a 1 (altura da onda em px do quadro; na lente, de -1 (aperta) a 1 (incha))");
  });

  it("animates the new values with keys and keeps the paced ones still", () => {
    const plan = run([
      { op: "add_vfx", ref: "w", clip_id: "a", vfx_kind: "waveWarp" },
      { op: "animate_vfx", clip_id: "a", vfx_id: "@w", vfx_property: "phase", keys: [{ at_ms: 0, value: 0 }, { at_ms: 1000, value: 360 }] },
    ]);
    expect(plan.ok && findClip(plan.final, "a")?.clip.vfx?.[0].keyframes?.phase).toHaveLength(2);
    expect(reason([{ op: "add_vfx", ref: "w", clip_id: "a", vfx_kind: "waveWarp" }, { op: "animate_vfx", clip_id: "a", vfx_id: "@w", vfx_property: "speed", keys: [{ at_ms: 0, value: 1 }] }])).toContain("não recebe chaves");
  });
});
