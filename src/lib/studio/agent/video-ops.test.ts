import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, STUDIO_LIMITS, type Clip, type VideoDocument } from "../document";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { applyVideoOperation, VIDEO_ID_FIELDS, type VideoOpContext, type VideoOperation } from "./video-ops";

function clip(id: string, startMs: number, durationMs: number, type: Clip["type"] = "video", linkId?: string): Clip {
  return { ...newMediaClip(type === "overlay" ? "image" : type, `m-${id}`, startMs, durationMs), id, type, ...(linkId ? { linkId } : {}) };
}

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [clip("a", 0, 2000, "video", "k1"), clip("b", 3000, 2000)] },
    { id: "v2", kind: "visual", clips: [] },
    { id: "au", kind: "audio", clips: [clip("a-audio", 0, 2000, "audio", "k1"), clip("m", 2000, 3000, "audio")] },
  ];
  d.durationMs = 5000;
  return d;
}

const VTT = "WEBVTT\n\n00:00:00.000 --> 00:00:01.200\nOlá, tudo bem?\n\n00:00:01.300 --> 00:00:02.000\nVamos lá\n";

const SRT = "1\r\n00:00:00,000 --> 00:00:01,200\r\nOlá, tudo bem?\r\n\r\n2\r\n00:00:01,300 --> 00:00:02,000\r\nVamos lá\r\n";

const ctx: VideoOpContext = {
  playheadMs: 1000,
  magnetic: false,
  mediaType: (id) => (id === "img-1" ? "image" : id === "vid-1" ? "video" : id === "song" ? "audio" : null),
  sourceDuration: (id) => (id === "vid-1" ? 4000 : id === "song" ? 30_000 : id.startsWith("m-") ? 10_000 : undefined),
  captions: (id) => ({ "vtt-1": VTT, "srt-1": SRT, "notes-1": "uma lista de compras" })[id],
  captionTrackName: "Legendas",
  icons: ["heart", "star"],
};

function run(ops: VideoOperation[], base: VideoDocument = doc()) {
  return planBatch(base, ops, (d, op) => applyVideoOperation(d, op, ctx), VIDEO_ID_FIELDS);
}

function done(ops: VideoOperation[], base?: VideoDocument): VideoDocument {
  const plan = run(ops, base);
  if (!plan.ok) throw new Error(`${plan.op}: ${plan.reason}`);
  expect(documentIssue("video", plan.final)).toBeNull();
  return plan.final;
}

describe("video operations", () => {
  it("adds a library video with its sound, like a drop from the media panel", () => {
    const next = done([{ op: "add_media", media_id: "vid-1", at_ms: 5000 }]);
    const added = next.tracks.flatMap((t) => t.clips).filter((c) => c.assetId === "vid-1");
    expect(added.map((c) => c.type).sort()).toEqual(["audio", "video"]);
    expect(added.every((c) => c.startMs === 5000 && c.durationMs === 4000)).toBe(true);
  });

  it("refuses media that is not in the library", () => {
    expect(run([{ op: "add_media", media_id: "ghost" }])).toMatchObject({ ok: false, index: 0 });
  });

  it("creates an animated title in one batch through refs", () => {
    const next = done([
      { op: "add_text", ref: "title", text: "Oferta de hoje", style: "headline", at_ms: 0, duration_ms: 3000, y: 0.25 },
      { op: "entrance", clip_id: "@title", effect: "slideUp", duration_ms: 400 },
      { op: "animate", clip_id: "@title", property: "scale", keys: [{ at_ms: 400, value: 1 }, { at_ms: 2600, value: 1.08, easing: "easeInOut" }] },
    ]);
    const title = next.tracks.flatMap((t) => t.clips).find((c) => c.layer?.text === "Oferta de hoje")!;
    expect(title.durationMs).toBe(3000);
    expect(title.transform.y).toBe(0.25);
    expect(title.motionIn).toEqual({ edge: "bottom", durationMs: 400 });
    expect(title.keyframes?.scale?.map((k) => k.value)).toEqual([1, 1.08]);
  });

  it("styles a text and refuses an unknown font with the list of real ones", () => {
    const plan = run([{ op: "add_text", text: "Oi", font_id: "comic-sans" }]);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("montserrat");
    const next = done([{ op: "add_text", ref: "t", text: "Oi", style: "caption" }, { op: "update_clip", clip_id: "@t", fill: "#ffd23f", font_size: 0.05, font_weight: 800 }]);
    const text = next.tracks.flatMap((t) => t.clips).find((c) => c.layer?.text === "Oi")!;
    expect(text.layer).toMatchObject({ fill: "#ffd23f", fontSize: 0.05, fontWeight: 800 });
  });

  it("designs overlays with the same vocabulary as the image editor: gradient, highlight, curve and blend", () => {
    const next = done([
      { op: "add_text", ref: "t", text: "Promoção", style: "caption", gradient: { kind: "linear", from: "#ff8a00", to: "#e52e71", angle: 90 }, highlight: { color: "#111111", radius: 0.3 }, curve: 0.4, blend_mode: "screen" },
      { op: "add_shape", ref: "s", shape: "rect", x: 0.5, y: 0.8, w: 0.6, h: 0.1, gradient: { kind: "radial", from: "#ffffff", to: "#000000" } },
    ]);
    const clips = next.tracks.flatMap((t) => t.clips);
    const text = clips.find((c) => c.layer?.text === "Promoção")!;
    expect(text.layer).toMatchObject({ gradient: { from: "#ff8a00", to: "#e52e71", angle: 90 }, highlight: { color: "#111111", radius: 0.3 }, curve: 0.4, blendMode: "screen" });
    const shape = clips.find((c) => c.layer?.type === "shape")!;
    expect(shape.layer?.gradient).toMatchObject({ kind: "radial" });
  });

  it("reports text only effects asked on a shape and clears effects on demand", () => {
    const plan = run([
      { op: "add_shape", ref: "s", shape: "rect", x: 0.5, y: 0.5, w: 0.3, h: 0.3, highlight: { color: "#111111" }, blend_mode: "multiply" },
      { op: "update_clip", clip_id: "@s", clear: ["blend_mode"] },
    ]);
    if (!plan.ok) throw new Error(plan.reason);
    expect(plan.notes.join(" ")).toContain("highlight");
    const shape = plan.final.tracks.flatMap((t) => t.clips).find((c) => c.layer?.type === "shape")!;
    expect(shape.layer?.blendMode).toBeUndefined();
    expect(shape.layer?.highlight).toBeUndefined();
  });

  it("adds an icon from the catalog over the video", () => {
    const next = done([{ op: "add_icon", icon_id: "heart", at_ms: 0, duration_ms: 1500, x: 0.8, y: 0.2, w: 0.1, h: 0.1, fill: "#ff3366" }]);
    const icon = next.tracks.flatMap((t) => t.clips).find((c) => c.layer?.type === "icon")!;
    expect(icon.layer).toMatchObject({ iconId: "heart", fill: "#ff3366" });
    expect(icon.durationMs).toBe(1500);
    const plan = run([{ op: "add_icon", icon_id: "unicorn" }]);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("heart");
  });

  it("moves a clip with its linked sound", () => {
    const next = done([{ op: "move_clip", clip_id: "a", start_ms: 5000 }]);
    expect(findClip(next, "a")!.clip.startMs).toBe(5000);
    expect(findClip(next, "a-audio")!.clip.startMs).toBe(5000);
  });

  it("trims and splits like the timeline tools", () => {
    const trimmed = done([{ op: "trim_clip", clip_id: "b", start_ms: 3500, end_ms: 4500 }]);
    expect(findClip(trimmed, "b")!.clip).toMatchObject({ startMs: 3500, durationMs: 1000, trimInMs: 500 });
    const split = run([{ op: "split_clip", ref: "right", clip_id: "b", at_ms: 4000 }]);
    expect(split.ok).toBe(true);
    if (!split.ok) return;
    expect(split.created.right).toHaveLength(1);
    expect(findClip(split.final, "b")!.clip.durationMs).toBe(1000);
  });

  it("ripple deletes and closes the hole", () => {
    const next = done([{ op: "delete_clips", clip_ids: ["a"], ripple: true }]);
    expect(findClip(next, "a")).toBeNull();
    expect(findClip(next, "a-audio")).toBeNull();
    expect(findClip(next, "b")!.clip.startMs).toBe(1000);
  });

  it("explains a missing clip instead of pretending", () => {
    const plan = run([{ op: "trim_clip", clip_id: "nope", end_ms: 100 }]);
    expect(plan).toMatchObject({ ok: false, index: 0 });
    if (!plan.ok) expect(plan.reason).toContain("studio_read");
  });

  it("refuses to edit a locked track", () => {
    const locked = doc();
    locked.tracks[0].locked = true;
    expect(run([{ op: "move_clip", clip_id: "b", start_ms: 4000 }], locked).ok).toBe(false);
  });

  it("applies keyframe presets and entrances to several clips at once", () => {
    const next = done([{ op: "motion_preset", clip_ids: ["a", "b"], preset: "kenBurns" }]);
    expect(findClip(next, "a")!.clip.keyframes?.scale).toBeDefined();
    expect(findClip(next, "b")!.clip.keyframes?.scale).toBeDefined();
  });

  it("removes an animation when animate gets no keys", () => {
    const animated = done([{ op: "animate", clip_id: "b", property: "x", keys: [{ at_ms: 0, value: 0.2 }, { at_ms: 1000, value: 0.8 }] }]);
    const cleared = done([{ op: "animate", clip_id: "b", property: "x", keys: [] }], animated);
    expect(findClip(cleared, "b")!.clip.keyframes).toBeUndefined();
  });

  it("refuses an animation out of range", () => {
    expect(run([{ op: "animate", clip_id: "b", property: "opacity", keys: [{ at_ms: 0, value: 3 }] }]).ok).toBe(false);
    expect(run([{ op: "animate", clip_id: "m", property: "opacity", keys: [{ at_ms: 0, value: 1 }] }]).ok).toBe(false);
  });

  it("tells exactly which key broke the range and what the range is", () => {
    const plan = run([{ op: "animate", clip_id: "b", property: "scale", keys: [{ at_ms: 0, value: 1 }, { at_ms: 500, value: 0 }] }]);
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.reason).toContain("scale em 500 ms vale 0");
      expect(plan.reason).toContain("de 0.05 a 5");
    }
  });

  it("refuses keys past the clip and explains that time counts from the clip start", () => {
    const plan = run([{ op: "animate", clip_id: "b", property: "opacity", keys: [{ at_ms: 0, value: 0 }, { at_ms: 3500, value: 1 }] }]);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("de 0 a 2000 ms");
  });

  it("gives the largest scale a full frame clip can take", () => {
    const plan = run([{ op: "animate", clip_id: "b", property: "scale", keys: [{ at_ms: 0, value: 1 }, { at_ms: 1000, value: 4.5 }] }]);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("scale até 4");
  });

  it("names the locked track before animating", () => {
    const locked = doc();
    locked.tracks[0].locked = true;
    const plan = run([{ op: "animate", clip_id: "b", property: "x", keys: [{ at_ms: 0, value: 0.4 }] }], locked);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("faixa travada");
  });

  it("applies a preset however many keyframes the video already has", () => {
    const busy = doc();
    const keys = (count: number) => Array.from({ length: count }, (_, i) => ({ atMs: i * 10, value: 0.5, easing: "linear" as const }));
    busy.tracks[1].clips = Array.from({ length: 13 }, (_, i) => ({ ...clip(`k${i}`, i * 380, 380, "image"), keyframes: { x: keys(32) } }));
    const plan = run([{ op: "motion_preset", clip_ids: ["b"], preset: "kenBurns" }], busy);
    expect(plan.ok).toBe(true);
  });

  it("puts a new text above whatever is on screen at that moment", () => {
    const plan = run([
      { op: "add_shape", ref: "bg", shape: "rect", at_ms: 0, duration_ms: 5000, x: 0.5, y: 0.5, w: 1, h: 1, fill: "#0b0f12", track_id: "v2" },
      { op: "add_text", ref: "t", text: "Oferta", at_ms: 2100, duration_ms: 800 },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const trackOf = (id: string) => plan.final.tracks.findIndex((t) => t.clips.some((c) => c.id === id));
    expect(trackOf(plan.created.t[0])).toBeGreaterThan(trackOf(plan.created.bg[0]));
  });

  it("moves, trims and duplicates clips that have entrance and exit effects", () => {
    const plan = run([
      { op: "entrance", clip_id: "b", effect: "fade", duration_ms: 400 },
      { op: "exit", clip_id: "b", effect: "fade", duration_ms: 400 },
      { op: "move_clip", clip_id: "b", start_ms: 3200 },
      { op: "trim_clip", clip_id: "b", end_ms: 4600 },
      { op: "duplicate_clips", clip_ids: ["b"] },
      { op: "split_clip", clip_id: "b", at_ms: 3900 },
    ]);
    expect(plan.ok ? null : plan.reason).toBeNull();
    if (plan.ok) expect(documentIssue("video", plan.final)).toBeNull();
    const linked = run([
      { op: "entrance", clip_id: "a", effect: "slideUp", duration_ms: 500 },
      { op: "exit", clip_id: "a", effect: "fade", duration_ms: 500 },
      { op: "trim_clip", clip_id: "a", start_ms: 400, end_ms: 1800 },
      { op: "duplicate_clips", clip_ids: ["a"] },
    ]);
    expect(linked.ok ? null : linked.reason).toBeNull();
    const magnetic = planBatch<VideoDocument, VideoOperation>(doc(), [
      { op: "entrance", clip_id: "b", effect: "fade", duration_ms: 400 },
      { op: "move_clip", clip_id: "b", start_ms: 2500 },
      { op: "trim_clip", clip_id: "b", end_ms: 4200 },
    ], (d, op) => applyVideoOperation(d, op, { ...ctx, magnetic: true }), VIDEO_ID_FIELDS);
    expect(magnetic.ok ? null : magnetic.reason).toBeNull();
  });

  it("names what blocks a trim and notes when it had to stop short", () => {
    const linked = run([{ op: "trim_clip", clip_id: "a", end_ms: 3500 }]);
    expect(linked.ok).toBe(false);
    if (!linked.ok) expect(linked.reason).toMatch(/clipe m .*2000 ms/);
    const slack = doc();
    slack.tracks[0].clips[1] = { ...slack.tracks[0].clips[1], trimInMs: 2000 };
    const short = run([{ op: "trim_clip", clip_id: "b", start_ms: 1500 }], slack);
    expect(short.ok).toBe(true);
    if (!short.ok) return;
    expect(findClip(short.final, "b")?.clip.startMs).toBe(2000);
    expect(short.notes.join(" ")).toMatch(/clipe a termina em 2000 ms/);
    const full = run([{ op: "trim_clip", clip_id: "b", end_ms: 6000 }]);
    expect(full.ok && full.notes).toEqual([]);
  });

  it("moves a clip onto a busy spot by opening a track above, and names what blocks a linked move", () => {
    const busy = run([{ op: "move_clip", clip_id: "b", start_ms: 1000 }]);
    expect(busy.ok).toBe(true);
    if (!busy.ok) return;
    const placed = findClip(busy.final, "b")!;
    expect(placed.clip.startMs).toBe(1000);
    expect(busy.final.tracks.findIndex((t) => t.id === placed.track.id)).toBe(1);
    expect(busy.notes.join(" ")).toContain("já tem o clipe a");
    const linked = run([{ op: "move_clip", clip_id: "a", start_ms: 2500 }]);
    expect(linked.ok).toBe(false);
    if (!linked.ok) expect(linked.reason).toMatch(/clipe m/);
  });

  it("keeps the intent of a busy, locked or unfitting track_id and only refuses an invented one", () => {
    const trackOf = (plan: ReturnType<typeof run>, id: string) => (plan.ok ? plan.final.tracks.findIndex((t) => t.clips.some((c) => c.id === id)) : -1);
    const text = run([{ op: "add_text", ref: "t", text: "Oferta", at_ms: 500, duration_ms: 1000, track_id: "v1" }]);
    expect(text.ok).toBe(true);
    if (!text.ok) return;
    expect(trackOf(text, text.created.t[0])).toBeGreaterThan(0);
    expect(text.notes.join(" ")).toContain("já tem o clipe a");
    const shape = run([{ op: "add_shape", ref: "s", shape: "rect", at_ms: 3500, duration_ms: 500, track_id: "v1" }]);
    expect(shape.ok).toBe(true);
    if (!shape.ok) return;
    expect(trackOf(shape, shape.created.s[0])).toBe(1);
    expect(shape.final.tracks[1].id).not.toBe("v2");
    expect(shape.notes.join(" ")).toContain("já tem o clipe b");
    const locked = doc();
    locked.tracks[1].locked = true;
    const held = run([{ op: "add_shape", ref: "s", shape: "rect", at_ms: 0, duration_ms: 500, track_id: "v2" }], locked);
    expect(held.ok && held.notes.join(" ")).toContain("travada");
    const audio = run([{ op: "add_text", ref: "a", text: "Oferta", at_ms: 0, track_id: "au" }]);
    expect(audio.ok).toBe(true);
    if (!audio.ok) return;
    expect(audio.final.tracks[trackOf(audio, audio.created.a[0])].kind).toBe("visual");
    expect(audio.notes.join(" ")).toContain("áudio");
    const invented = run([{ op: "add_text", text: "Oferta", at_ms: 0, track_id: "nope" }]);
    expect(invented.ok).toBe(false);
    if (!invented.ok) expect(invented.reason).toContain("não existe");
    const placed = run([{ op: "add_text", ref: "t", text: "Oferta", at_ms: 0, duration_ms: 1000, track_id: "v2" }]);
    expect(placed.ok && placed.final.tracks[1].clips.some((c) => c.id === placed.created.t[0])).toBe(true);
    expect(placed.ok && placed.notes).toEqual([]);
  });

  it("ignores text and style on a video clip and applies the rest", () => {
    const plan = run([{ op: "update_clip", clip_id: "b", volume: 0.5, fill: "#111111" }]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(findClip(plan.final, "b")?.clip.volume).toBe(0.5);
    expect(plan.notes.join(" ")).toContain("fill só vale para textos e formas sobre o vídeo");
    const only = run([{ op: "update_clip", clip_id: "b", fill: "#111111" }]);
    expect(only.ok).toBe(false);
    if (!only.ok) expect(only.reason).toContain("nada foi aplicado");
  });

  it("stacks as many elements on one moment as the scene needs", () => {
    const parts = Array.from({ length: 24 }, (_, i) => ({ op: "add_shape" as const, shape: "rect" as const, at_ms: 0, duration_ms: 2000, x: 0.5, y: (i + 1) / 26, w: 0.8, h: 0.03, fill: "#222222" }));
    const plan = run([...parts, { op: "add_text", ref: "t", text: "Oferta", at_ms: 0, duration_ms: 2000 }]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const busy = plan.final.tracks.filter((t) => t.kind === "visual" && t.clips.some((c) => c.startMs < 2000)).length;
    expect(busy).toBeGreaterThanOrEqual(25);
  });

  it("applies what fits a clip and reports the fields it ignored", () => {
    const plan = run([
      { op: "add_shape", ref: "s", shape: "rect", at_ms: 0, duration_ms: 1000, fill: "#e10600", font_id: "inter" },
      { op: "update_clip", clip_id: "@s", fill: "#111111", italic: true },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(findClip(plan.final, plan.created.s[0])?.clip.layer).toMatchObject({ shape: "rect", fill: "#111111" });
    expect(plan.notes).toEqual(["operação 1 (add_shape): font_id só vale para camadas de texto", `operação 2 (update_clip): clipe ${plan.created.s[0]}: italic só vale para camadas de texto`]);
  });

  it("draws vector shapes over the video from path data and presets", () => {
    const plan = run([
      { op: "add_shape", ref: "band", shape: "path", path: "M0 0.6 L1 0.4 L1 1 L0 1 Z", at_ms: 0, duration_ms: 2000, x: 0.5, y: 0.85, w: 1, h: 0.3, fill: "#e10600" },
      { op: "add_shape", ref: "burst", path_preset: "burst", at_ms: 0, duration_ms: 2000, x: 0.8, y: 0.2, w: 0.25, h: 0.25, fill: "#ffcc00" },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(documentIssue("video", plan.final)).toBeNull();
    expect(findClip(plan.final, plan.created.band[0])?.clip.layer).toMatchObject({ shape: "path", path: "M0 0.6 L1 0.4 L1 1 L0 1 Z" });
    expect(findClip(plan.final, plan.created.burst[0])?.clip.layer).toMatchObject({ shape: "star", points: 16 });
  });

  it("explains when a clip would start too close to the end of the video", () => {
    const plan = run([{ op: "add_shape", shape: "rect", at_ms: STUDIO_LIMITS.maxVideoMs - 50, duration_ms: 1000 }]);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain(`${STUDIO_LIMITS.maxVideoMs} ms`);
  });

  it("lays captions from a finished job under the speaking clip", () => {
    const plan = run([{ op: "add_captions", ref: "captions", media_id: "vtt-1", clip_id: "a" }]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const track = plan.final.tracks.find((t) => t.name === "Legendas")!;
    expect(track.clips.map((c) => c.layer?.text)).toEqual(["Olá, tudo bem?", "Vamos lá"]);
    expect(plan.created.captions).toEqual(track.clips.map((c) => c.id));
  });

  it("lays captions from a SubRip file in the library the same way", () => {
    const plan = run([{ op: "add_captions", media_id: "srt-1", clip_id: "a" }]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.final.tracks.find((t) => t.name === "Legendas")!.clips.map((c) => c.layer?.text)).toEqual(["Olá, tudo bem?", "Vamos lá"]);
  });

  it("refuses a library file that holds no captions", () => {
    const plan = run([{ op: "add_captions", media_id: "notes-1", clip_id: "a" }]);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("WebVTT ou SRT");
  });

  it("manages tracks", () => {
    const plan = run([
      { op: "add_track", ref: "fx", kind: "visual", name: "Efeitos" },
      { op: "move_track", track_id: "@fx", to_index: 0 },
      { op: "update_track", track_id: "au", muted: true },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.final.tracks[0].name).toBe("Efeitos");
    expect(plan.final.tracks.find((t) => t.id === "au")!.muted).toBe(true);
  });

  it("sets the format and background, and seeks and selects without changing the document", () => {
    const next = done([{ op: "set_canvas", aspect: "square", background: "#112233" }]);
    expect(next.canvas).toEqual({ aspect: "square", background: "#112233" });
    const plan = run([{ op: "seek", at_ms: 2500 }, { op: "select", clip_ids: ["b"] }]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.final).toEqual(doc());
    expect(plan.steps[0].seekMs).toBe(2500);
    expect(plan.steps[1].select).toEqual(["b"]);
    expect(run([{ op: "set_canvas", background: "red" }]).ok).toBe(false);
  });

  it("changes volume and fades of a sound", () => {
    const next = done([{ op: "update_clip", clip_id: "m", volume: 0.2, fade_out_ms: 1500 }]);
    expect(findClip(next, "m")!.clip).toMatchObject({ volume: 0.2, fadeOutMs: 1500 });
  });
});

describe("locked tracks", () => {
  it("never deletes part of a group silently", () => {
    const locked = doc();
    locked.tracks[2].locked = true;
    expect(run([{ op: "delete_clips", clip_ids: ["a"] }], locked).ok).toBe(false);
  });
});

describe("idempotent edits", () => {
  it("accepts a value that is already set, but still refuses a locked track", () => {
    expect(run([{ op: "update_clip", clip_id: "m", volume: 1 }]).ok).toBe(true);
    const locked = doc();
    locked.tracks[2].locked = true;
    const plan = run([{ op: "update_clip", clip_id: "m", volume: 0.5 }], locked);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("travada");
  });
});
