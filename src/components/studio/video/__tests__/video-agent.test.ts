import { describe, expect, it, vi } from "vitest";

import type { ScreenCommand, ScreenReply } from "@/lib/aichat/screen";
import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";

import { createAgentPresence } from "../../agent/presence";
import { AgentFollower } from "../agent-follow";
import { createVideoEditorRuntime } from "../runtime";
import { createVideoAgent } from "../video-agent";

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
  const agent = createVideoAgent({ editor: runtime, presence: createAgentPresence(), follower, captionTrackName: "Legendas", label: (a) => a, reduceMotion: () => true });
  const run = (name: ScreenCommand["name"], args?: unknown): Promise<ScreenReply> => agent({ id: "cmd", name, projectId: "p-1", args });
  return { runtime, run, follower };
}

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
    if (!reply.ok) expect(reply.error.message).toContain("operação 2");
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
