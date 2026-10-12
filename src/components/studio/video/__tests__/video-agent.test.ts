import { describe, expect, it, vi } from "vitest";

import type { ScreenCommand, ScreenReply } from "@/lib/aichat/screen";
import { emptyVideoDocument, newMediaClip, newOverlayClip, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";
import { gainToDb } from "@/lib/studio/audio-gain";
import { clipLoudness, loudnessProfile, type LoudnessProfile } from "@/lib/studio/loudness";

import { createAgentPresence } from "../../agent/presence";
import { AgentFollower } from "../agent-follow";
import { createVideoEditorRuntime } from "../runtime";
import { createVideoAgent } from "../video-agent";
import type { LocalExport } from "@/lib/studio/export";
import { createVideoExporter } from "../export/video-exporter";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async (id: string) => ({ id, description: `Mídia ${id}`, url: `blob:${id}`, previewUrl: "", createdAt: "", type: id.startsWith("aud") ? "audio" : "video" })),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null })),
  uploadMediaAction: vi.fn(),
}));

vi.mock("@/app/actions/media-generation", () => ({
  requestMediaGenerationAction: vi.fn(),
  getMediaGenerationAction: vi.fn(),
}));

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", "vid-1", 0, 3000), id: "c1" }] },
    { id: "v2", kind: "visual", clips: [] },
    { id: "a1", kind: "audio", clips: [{ ...newMediaClip("audio", "aud-1", 0, 3000), id: "m1" }] },
  ];
  d.durationMs = 3000;
  return d;
}

function setup() {
  const runtime = createVideoEditorRuntime(doc());
  runtime.assets.sourceDuration = vi.fn(async () => 10_000);
  const follower = new AgentFollower({ view: runtime.view, seek: (ms) => runtime.playback.seek(ms), frames: { request: () => 0, cancel: () => undefined }, now: () => 0, reduceMotion: () => true });
  follower.attach();
  let finishExport: ((value: LocalExport) => void) | null = null;
  const exporter = createVideoExporter({
    document: () => runtime.store.getState().document,
    commit: () => runtime.store.getState().commitTransaction(),
    flush: async () => undefined,
    committed: () => ({ version: 1, settled: true }),
    lutReadable: async () => true,
    local: () => new Promise((resolve) => (finishExport = resolve)),
    refreshLibrary: () => undefined,
  });
  const agent = createVideoAgent({ editor: runtime, exporter, presence: createAgentPresence(), follower, captionTrackName: "Legendas", label: (a) => a, reduceMotion: () => true });
  const run = (name: ScreenCommand["name"], args?: unknown): Promise<ScreenReply> => agent({ id: "cmd", name, projectId: "p-1", args });
  const finish = async (value: LocalExport) => {
    await vi.waitFor(() => expect(finishExport).not.toBeNull());
    finishExport!(value);
    finishExport = null;
  };
  return { runtime, run, follower, exporter, finish, agent };
}

describe("Elo exporting the video", () => {
  it("starts the export like the button, refuses a second one, and reads the saved media when it ends", async () => {
    const { run, finish } = setup();
    expect(await run("export")).toMatchObject({ ok: true, data: { started: true } });
    await Promise.resolve();
    expect(await run("export")).toMatchObject({ ok: false, error: { code: "export_busy" } });
    await finish({ status: "done", result: { mediaId: "m-9", mediaUrl: "https://x/m-9.mp4" } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const reply = await run("read", { detail: "summary" });
    expect(reply).toMatchObject({ ok: true, data: { export: { status: "done", format: "mp4", media_id: "m-9", url: "https://x/m-9.mp4", outdated: false } } });
  });

  it("exports a gif or webp with the settings Elo asked for, through the same exporter as the button", async () => {
    const { run, finish, exporter } = setup();
    expect(await run("export", { format: "gif", width: 320, fps: 12, colors: 64, dither: "none", loop: 1 })).toMatchObject({ ok: true, data: { started: true, format: "gif" } });
    expect(exporter.store.getState().request).toEqual({ format: "gif", width: 320, fps: 12, loop: 1, colors: 64, dither: "none" });
    await finish({ status: "done", result: { mediaId: "g-1", mediaUrl: "https://x/g-1.gif" } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await run("read", { detail: "summary" })).toMatchObject({ ok: true, data: { export: { status: "done", format: "gif", media_id: "g-1" } } });
  });

  it("exports a range of the film or one frame as an image, and reads the marked work area", async () => {
    const { run, exporter, runtime } = setup();
    expect(await run("export", { format: "mp4", from_ms: 500, to_ms: 2000 })).toMatchObject({ ok: true, data: { started: true, format: "mp4" } });
    expect(exporter.store.getState().request).toEqual({ format: "mp4", range: { startMs: 500, endMs: 2000 } });
    const second = setup();
    expect(await second.run("export", { format: "jpeg", at_ms: 1200, quality: 0.7 })).toMatchObject({ ok: true, data: { format: "jpeg" } });
    expect(second.exporter.store.getState().request).toEqual({ format: "jpeg", atMs: 1200, quality: 0.7 });
    runtime.view.setState({ range: { inMs: 1000, outMs: 2500 } });
    expect(await run("read", { detail: "summary" })).toMatchObject({ ok: true, data: { work_area: { from_ms: 1000, to_ms: 2500 }, export: { status: "preparing", from_ms: 500, to_ms: 2000 } } });
  });

  it("refuses ranges outside the film and frames past its end", async () => {
    const { run, exporter } = setup();
    expect(await run("export", { from_ms: 2000, to_ms: 4000 })).toMatchObject({ ok: false, error: { code: "invalid_export" } });
    expect(await run("export", { format: "png", at_ms: 3000 })).toMatchObject({ ok: false, error: { code: "invalid_export" } });
    expect(exporter.busy()).toBe(false);
  });

  it("refuses settings the export cannot use, starting nothing", async () => {
    const { run, exporter } = setup();
    expect(await run("export", { format: "gif", width: 2000 })).toMatchObject({ ok: false, error: { code: "invalid_export" } });
    expect(await run("export", { format: "png" })).toMatchObject({ ok: false, error: { code: "invalid_export" } });
    expect(exporter.busy()).toBe(false);
  });
});

describe("Elo in the video editor", () => {
  it("reads the timeline as the editor shows it", async () => {
    const { run } = setup();
    const reply = await run("read", { detail: "summary" });
    expect(reply.ok).toBe(true);
    if (!reply.ok) return;
    const outline = reply.data as { tracks: { id: string; clips: { id: string; media?: string }[] }[] };
    expect(outline.tracks.map((t) => t.id)).toEqual(["v1", "v2", "a1"]);
    expect(outline.tracks[0].clips[0]).toMatchObject({ id: "c1", media: "Mídia vid-1" });
  });

  it("adds measured motion alerts to the read when a clip jumps, and none when all is well", async () => {
    const { runtime, run } = setup();
    const clean = await run("read", { detail: "summary" });
    expect(clean.ok && "alerts" in (clean.data as object)).toBe(false);
    const jumpy = { ...newOverlayClip({ id: "t-layer", type: "text", text: "Pulo", fontSize: 0.05, fill: "#ffffff", transform: { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 } }, 0, 3000), id: "t1", keyframes: { x: [{ atMs: 1000, value: 0.2, easing: "linear" as const }, { atMs: 1033, value: 0.8, easing: "linear" as const }] } };
    runtime.store.getState().apply((doc) => ({ ...doc, tracks: [{ ...doc.tracks[0], clips: [...doc.tracks[0].clips, jumpy] }, ...doc.tracks.slice(1)] }));
    const reply = await run("read", { detail: "summary" });
    expect(reply).toMatchObject({ ok: true, data: { alerts: expect.arrayContaining([expect.stringMatching(/^aviso: t1 \("Pulo"\) salta/)]) } });
  });

  it("applies a batch as one step the person can undo", async () => {
    const { runtime, run } = setup();
    const reply = await run("edit", {
      operations: [
        { op: "add_text", ref: "title", text: "Oferta", style: "headline", at_ms: 0, duration_ms: 2000 },
        { op: "entrance", clip_id: "@title", effect: "fade", duration_ms: 300 },
        { op: "update_clip", clip_id: "m1", volume: 0.3 },
      ],
    });
    expect(reply.ok).toBe(true);
    if (!reply.ok) return;
    const created = (reply.data as { created: Record<string, string[]> }).created.title[0];
    const state = runtime.store.getState();
    expect(findClip(state.document, created)?.clip.fadeInMs).toBe(300);
    expect(findClip(state.document, "m1")?.clip.volume).toBe(0.3);
    state.undo();
    expect(findClip(runtime.store.getState().document, created)).toBeNull();
    expect(findClip(runtime.store.getState().document, "m1")?.clip.volume).toBe(1);
  });

  it("changes nothing when the turn never lets a change go", async () => {
    const { runtime, agent } = setup();
    const before = runtime.store.getState().document;
    const denied = vi.fn(async () => false);
    const edit = await agent({ id: "cmd", name: "edit", projectId: "p-1", args: { operations: [{ op: "update_clip", clip_id: "m1", volume: 0.3 }] }, claim: denied });
    expect(edit).toMatchObject({ ok: false, error: { code: "expired" } });
    const preset = await agent({ id: "cmd-2", name: "save_preset", projectId: "p-1", args: { clip_id: "m1", name: "Entrada" }, claim: denied });
    expect(preset).toMatchObject({ ok: false, error: { code: "expired" } });
    expect(denied).toHaveBeenCalledTimes(2);
    expect(runtime.store.getState().document).toBe(before);
    const allowed = await agent({ id: "cmd-3", name: "edit", projectId: "p-1", args: { operations: [{ op: "update_clip", clip_id: "m1", volume: 0.3 }] }, claim: async () => true });
    expect(allowed.ok).toBe(true);
    expect(findClip(runtime.store.getState().document, "m1")?.clip.volume).toBe(0.3);
  });

  it("measures the sound before normalizing it and reads the loudness of each audio track back", async () => {
    const { runtime, run } = setup();
    const tone = Float32Array.from({ length: 8000 * 4 }, (_, i) => 0.25 * Math.sin((2 * Math.PI * 1000 * i) / 8000));
    const profile = loudnessProfile([tone], 8000);
    const measured = new Map<string, LoudnessProfile>();
    vi.spyOn(runtime.audio, "loudness").mockImplementation(async (id) => {
      measured.set(id, profile);
      return profile;
    });
    vi.spyOn(runtime.audio, "loudnessOf").mockImplementation((id) => measured.get(id));
    const reply = await run("edit", { operations: [{ op: "normalize_loudness", clip_id: "m1", target_lufs: -16 }] });
    expect(reply.ok).toBe(true);
    const song = findClip(runtime.store.getState().document, "m1")!.clip;
    expect(clipLoudness(profile, song)! + gainToDb(song.volume)).toBeCloseTo(-16, 1);
    const outline = await run("read", { detail: "summary" });
    expect(outline).toMatchObject({ ok: true, data: { tracks: [{}, {}, { id: "a1", loudness_lufs: expect.any(Number) }] } });
  });

  it("reports design problems right after an edit, like a text hidden behind a new background", async () => {
    const { run } = setup();
    const reply = await run("edit", {
      operations: [
        { op: "add_text", ref: "title", text: "Oferta", at_ms: 0, duration_ms: 2500, track_id: "v2", fill: "#ffffff" },
        { op: "add_track", ref: "top", kind: "visual" },
        { op: "add_shape", shape: "rect", at_ms: 0, duration_ms: 3000, x: 0.5, y: 0.5, w: 1, h: 1, fill: "#0b0f12", track_id: "@top" },
      ],
    });
    expect(reply.ok).toBe(true);
    if (!reply.ok) return;
    const checks = (reply.data as { checks: string[] }).checks;
    expect(checks.some((line) => line.startsWith("erro") && line.includes("escondido"))).toBe(true);
  });

  it("applies nothing when one operation is refused and says which", async () => {
    const { runtime, run } = setup();
    const before = runtime.store.getState().document;
    const reply = await run("edit", { operations: [{ op: "update_clip", clip_id: "m1", volume: 0.5 }, { op: "trim_clip", clip_id: "ghost", end_ms: 100 }] });
    expect(reply).toMatchObject({ ok: false, error: { code: "operation_refused" } });
    expect(reply).toMatchObject({ data: { applied: [], refused: [{ operation: 2, op: "trim_clip" }], not_applied: [{ operation: 1, op: "update_clip" }] } });
    expect(runtime.store.getState().document).toBe(before);
  });

  it("tells Elo what the person changed since she last read", async () => {
    const { runtime, run } = setup();
    await run("read");
    runtime.store.getState().update((draft) => {
      draft.tracks[0].clips[0].durationMs = 2000;
    });
    const reply = await run("read");
    if (!reply.ok) throw new Error(reply.error.message);
    expect((reply.data as { changes_by_user?: { changed: string[] } }).changes_by_user?.changed).toEqual(["c1"]);
  });

  it("hands the job source over only for a clip that fits the job", async () => {
    const { run } = setup();
    expect(await run("resolve_source", { kind: "captions", clipId: "c1" })).toEqual({ ok: true, data: { sourceMediaId: "vid-1" } });
    expect(await run("resolve_source", { kind: "cutout", clipId: "c1" })).toMatchObject({ ok: false, error: { code: "wrong_source" } });
    expect(await run("resolve_source", { kind: "denoise", clipId: "ghost" })).toMatchObject({ ok: false, error: { code: "clip_not_found" } });
  });

  it("follows a queued job so the editor places the result like the panel does", async () => {
    const { runtime, run } = setup();
    const reply = await run("follow_job", { job: { id: "job-9", kind: "captions", status: "queued" }, purpose: "captions", clipId: "c1" });
    expect(reply.ok).toBe(true);
    const job = runtime.view.getState().jobs.at(-1)!;
    expect(job).toMatchObject({ purpose: "captions", byAgent: true, state: "running", target: { clipId: "c1", window: { startMs: 0, trimInMs: 0, durationMs: 3000 } } });
    expect(job.created?.id).toBe("job-9");
    expect(await run("follow_job", { job: { id: "x", kind: "captions", status: "queued" }, purpose: "export" })).toMatchObject({ ok: false });
  });

  it("remembers what a followed job started from, so a replaced clip is never overwritten", async () => {
    const { runtime, run } = setup();
    await run("follow_job", { job: { id: "job-10", kind: "captions", status: "queued", sourceMediaId: "vid-1" }, purpose: "captions", clipId: "c1" });
    expect(runtime.view.getState().jobs.at(-1)).toMatchObject({ startedFrom: "vid-1", created: { sourceMediaId: "vid-1" } });
  });

  it("follows a sound effect Elo queued for a time on an audio track", async () => {
    const { runtime, run } = setup();
    const reply = await run("follow_job", { job: { id: "job-sfx", kind: "sfx", status: "queued" }, purpose: "sfx", atMs: 1200, trackId: "a1" });
    expect(reply.ok).toBe(true);
    expect(runtime.view.getState().jobs.at(-1)).toMatchObject({ purpose: "sfx", byAgent: true, target: { atMs: 1200, trackId: "a1" } });
  });

  it("brings the playhead to where Elo edits, and leaves it alone once the person takes over", async () => {
    const { runtime, run, follower } = setup();
    await run("edit", { operations: [{ op: "add_text", ref: "late", text: "Fim", at_ms: 2000, duration_ms: 800, track_id: "v2" }] });
    expect(runtime.view.getState().playheadMs).toBeGreaterThanOrEqual(2000);
    runtime.playback.seek(100);
    await run("edit", { operations: [{ op: "add_text", ref: "again", text: "De novo", at_ms: 2500, duration_ms: 400, track_id: "v2" }] });
    expect(runtime.view.getState().playheadMs).toBe(100);
    follower.resume();
    await run("edit", { operations: [{ op: "add_text", ref: "third", text: "Agora", at_ms: 1500, duration_ms: 400, track_id: "v2" }] });
    expect(runtime.view.getState().playheadMs).toBeGreaterThanOrEqual(1500);
  });
});

describe("Elo looking at motion and listening", () => {
  it("refuses a focus that is not in the project and a malformed zoom before capturing anything", async () => {
    const { run } = setup();
    expect(await run("look", { focus_id: "nope" })).toMatchObject({ ok: false, error: { code: "invalid_look" } });
    expect(await run("look", { region: { x: 0.5, y: 0.5, w: 0, h: 0.2 } })).toMatchObject({ ok: false, error: { code: "invalid_region" } });
  });

  it("refuses to measure a range outside the video and a voice track that is not heard", async () => {
    const { run } = setup();
    expect(await run("listen", { from_ms: 2500, to_ms: 2000 })).toMatchObject({ ok: false, error: { code: "invalid_range" } });
    expect(await run("listen", { voice_track_ids: ["v1"] })).toMatchObject({ ok: false, error: { code: "invalid_voice" } });
  });
});
