import { describe, expect, it } from "vitest";

import { crossfadeLevel, voiceEdges } from "./audio-crossfade";
import { gainPoints } from "./audio-gain";
import { emptyVideoDocument, newMediaClip, type Clip, type VideoDocument } from "./document";
import { audioPlan, audioVoiceKeys, audioPlanChange } from "./playback";
import { addTransition, AUDIO_TRANSITION_KINDS, defaultTransitionKind, settleTransitions, transitionsIssue, updateTransition } from "./transitions";
import { documentIssue } from "./validate";

function audioDoc(first: Partial<Clip> = {}, second: Partial<Clip> = {}): VideoDocument {
  const doc = emptyVideoDocument("story");
  doc.durationMs = 10_000;
  doc.tracks[2].id = "music";
  doc.tracks[2].clips = [
    { ...newMediaClip("audio", "asset-a", 0, 4000), id: "a", ...first },
    { ...newMediaClip("audio", "asset-b", 4000, 4000), id: "b", trimInMs: 2000, ...second },
  ];
  return doc;
}

function crossfaded(doc: VideoDocument, durationMs = 1000, alignment: "center" | "start" | "end" = "center"): VideoDocument {
  const result = addTransition(doc, { fromClipId: "a", toClipId: "b", kind: "constantPower", durationMs, alignment });
  if (!result.ok) throw new Error(result.reason);
  return result.document;
}

const SOURCE = { sourceMs: () => 20_000 };

function valueAt(points: readonly { atMs: number; value: number }[], ms: number): number {
  const after = points.findIndex((p) => p.atMs >= ms);
  if (after < 0) return points.at(-1)!.value;
  if (after === 0) return points[0].value;
  const a = points[after - 1];
  const b = points[after];
  return a.value + ((b.value - a.value) * (ms - a.atMs)) / (b.atMs - a.atMs);
}

describe("crossfade curves", () => {
  it("keeps the power of constant power and the sum of constant gain", () => {
    for (const t of [0, 0.2, 0.5, 0.9, 1]) {
      const out = crossfadeLevel("constantPower", "linear", "from", t);
      const into = crossfadeLevel("constantPower", "linear", "to", t);
      expect(out * out + into * into).toBeCloseTo(1, 9);
      expect(crossfadeLevel("constantGain", "linear", "from", t) + crossfadeLevel("constantGain", "linear", "to", t)).toBeCloseTo(1, 9);
    }
    expect(crossfadeLevel("constantPower", "linear", "from", 0.5)).toBeCloseTo(Math.SQRT1_2, 9);
    expect(crossfadeLevel("constantPower", "easeInOut", "to", 0)).toBe(0);
  });
});

describe("audio crossfades on the cut", () => {
  it("sits on audio cuts with audio kinds only, and visual kinds stay on visual tracks", () => {
    expect(defaultTransitionKind("audio")).toBe("constantPower");
    expect(defaultTransitionKind("visual")).toBe("dissolve");
    expect(AUDIO_TRANSITION_KINDS).toEqual(["constantPower", "constantGain"]);
    const doc = crossfaded(audioDoc());
    expect(documentIssue("video", doc)).toBeNull();
    expect(transitionsIssue(doc.tracks[2])).toBeNull();
    expect(addTransition(audioDoc(), { fromClipId: "a", toClipId: "b", kind: "dissolve" })).toEqual({ ok: false, reason: "kind" });
    const visual = emptyVideoDocument("story");
    visual.durationMs = 4000;
    visual.tracks[0].clips = [{ ...newMediaClip("image", "i", 0, 2000), id: "x" }, { ...newMediaClip("image", "j", 2000, 2000), id: "y" }];
    expect(addTransition(visual, { fromClipId: "x", toClipId: "y", kind: "constantGain" })).toEqual({ ok: false, reason: "kind" });
    const id = doc.tracks[2].transitions![0].id;
    expect(updateTransition(doc, id, { kind: "push" })).toEqual({ ok: false, reason: "kind" });
    const swapped = updateTransition(doc, id, { kind: "constantGain" });
    expect(swapped.ok && swapped.document.tracks[2].transitions![0].kind).toBe("constantGain");
    expect(documentIssue("video", { ...doc, tracks: doc.tracks.map((t, i) => (i === 2 ? { ...t, transitions: [{ ...t.transitions![0], kind: "wipe" as const }] } : t)) })?.code).toBe("unknown");
  });

  it("drops a crossfade whose clips stop touching, like video transitions", () => {
    const doc = crossfaded(audioDoc());
    const apart = { ...doc.tracks[2], clips: [doc.tracks[2].clips[0], { ...doc.tracks[2].clips[1], startMs: 4500 }] };
    expect(settleTransitions(apart)).toBeUndefined();
  });

  it("plays the outgoing clip into its tail and the incoming clip from its head across the window", () => {
    const doc = crossfaded(audioDoc());
    const edgesA = voiceEdges(doc.tracks[2], doc.tracks[2].clips[0], SOURCE.sourceMs);
    const edgesB = voiceEdges(doc.tracks[2], doc.tracks[2].clips[1], SOURCE.sourceMs);
    expect(edgesA).toMatchObject({ headMs: 0, tailMs: 500, fadeOut: { fromMs: 3500, toMs: 4500 } });
    expect(edgesB).toMatchObject({ headMs: 500, tailMs: 0, fadeIn: { fromMs: -500, toMs: 500 } });
    const [a, b] = audioPlan(doc, 0, SOURCE);
    expect(a).toMatchObject({ clipId: "a", delayMs: 0, offsetMs: 0, durationMs: 4500 });
    expect(b).toMatchObject({ clipId: "b", delayMs: 3500, offsetMs: 1500, durationMs: 4500 });
    expect(valueAt(a.gain, 3500)).toBeCloseTo(1, 3);
    expect(valueAt(a.gain, 4000)).toBeCloseTo(Math.SQRT1_2, 2);
    expect(valueAt(a.gain, 4500)).toBeCloseTo(0, 3);
    expect(valueAt(b.gain, 0)).toBeCloseTo(0, 3);
    expect(valueAt(b.gain, 500)).toBeCloseTo(Math.SQRT1_2, 2);
    expect(valueAt(b.gain, 1000)).toBeCloseTo(1, 3);
  });

  it("fades a clip with a short handle over the material it has, so it never starts or stops abruptly", () => {
    const doc = crossfaded(audioDoc({}, { trimInMs: 200 }));
    const b = audioPlan(doc, 0, SOURCE).find((voice) => voice.clipId === "b")!;
    expect(b).toMatchObject({ delayMs: 3800, offsetMs: 0, durationMs: 4200 });
    expect(valueAt(b.gain, 0)).toBeCloseTo(0, 3);
    expect(valueAt(b.gain, 700)).toBeCloseTo(1, 3);
    const unknown = audioPlan(doc, 0).find((voice) => voice.clipId === "a")!;
    expect(unknown.durationMs).toBe(4000);
    expect(valueAt(unknown.gain, 3500)).toBeCloseTo(1, 3);
    expect(valueAt(unknown.gain, 4000)).toBeCloseTo(0, 3);
  });

  it("follows the alignment and resumes mid window from the playhead", () => {
    const doc = crossfaded(audioDoc(), 1000, "start");
    const [a, b] = audioPlan(doc, 4250, SOURCE);
    expect(a).toMatchObject({ clipId: "a", delayMs: 0, offsetMs: 4250, durationMs: 750 });
    expect(b).toMatchObject({ clipId: "b", delayMs: 0, offsetMs: 2250, durationMs: 3750 });
    expect(a.gain[0].value).toBeCloseTo(Math.cos((0.25 * Math.PI) / 2), 2);
  });

  it("extends a retimed window through the source and restarts voices when the crossfade changes", () => {
    const doc = crossfaded(audioDoc({ speed: 2, trimInMs: 0 }, { speed: 2, trimInMs: 4000 }));
    const [a, b] = audioPlan(doc, 0, SOURCE);
    expect(a.retime).toMatchObject({ trimInMs: 0, spanMs: 9000, speed: 2 });
    expect(a.durationMs).toBe(4500);
    expect(b.retime).toMatchObject({ trimInMs: 3000, spanMs: 9000, speed: 2 });
    expect(b).toMatchObject({ delayMs: 3500, offsetMs: 0, durationMs: 4500 });
    const before = audioVoiceKeys(doc);
    const id = doc.tracks[2].transitions![0].id;
    const longer = updateTransition(doc, id, { durationMs: 1500 });
    if (!longer.ok) throw new Error(longer.reason);
    expect(audioPlanChange(before, audioVoiceKeys(longer.document)).start.sort()).toEqual(["a", "b"]);
  });

  it("mirrors a reversed clip, taking its tail from before the trim", () => {
    const doc = crossfaded(audioDoc({ reverse: true, trimInMs: 300 }));
    const edges = voiceEdges(doc.tracks[2], doc.tracks[2].clips[0], SOURCE.sourceMs);
    expect(edges.tailMs).toBe(300);
    expect(edges.fadeOut).toMatchObject({ fromMs: 3500, toMs: 4300 });
    const a = audioPlan(doc, 0, SOURCE)[0];
    expect(a.retime).toMatchObject({ trimInMs: 0, spanMs: 4300, reverse: true });
    expect(a.durationMs).toBe(4300);
  });

  it("multiplies the crossfade into the gain chain only inside the window", () => {
    const doc = crossfaded(audioDoc({ volume: 0.5 }));
    const clip = doc.tracks[2].clips[0];
    const edges = voiceEdges(doc.tracks[2], clip, SOURCE.sourceMs);
    const points = gainPoints(clip, 0, { trackGainDb: 0, fadeOut: edges.fadeOut }, clip.durationMs + edges.tailMs);
    expect(valueAt(points, 1000)).toBeCloseTo(0.5, 6);
    expect(valueAt(points, 4000)).toBeCloseTo(0.5 * Math.SQRT1_2, 2);
  });
});
