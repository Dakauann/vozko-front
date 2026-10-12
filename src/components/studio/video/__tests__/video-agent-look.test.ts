import { afterEach, describe, expect, it, vi } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, type VideoDocument } from "@/lib/studio/document";

import { createAgentPresence, type AgentPresenceState } from "../../agent/presence";
import { placed } from "../../agent/test-placement";
import { AgentFollower } from "../agent-follow";
import { createVideoExporter } from "../export/video-exporter";
import { createVideoEditorRuntime } from "../runtime";
import { createVideoAgent, createVideoReveal } from "../video-agent";
import { captureVideo } from "../../agent/frame-capture";

const SHEET = "data:image/jpeg;base64,U0hFRVQ=";
const seenDuringCapture = vi.hoisted(() => ({ state: null as AgentPresenceState | null, read: (() => null) as () => AgentPresenceState | null }));

vi.mock("../../agent/frame-capture", () => ({
  captureVideo: vi.fn(async () => {
    seenDuringCapture.state = seenDuringCapture.read();
    return { image: SHEET, notes: [], approximate: false };
  }),
  captureMediaFrames: vi.fn(async () => SHEET),
  captureLibraryImage: vi.fn(async () => SHEET),
}));

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async (id: string) => ({ id, description: id, url: `blob:${id}`, previewUrl: "", createdAt: "", type: "video" })),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null })),
  uploadMediaAction: vi.fn(),
}));

vi.mock("../../canvas/lut-files", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../canvas/lut-files")>()), lutReadable: async (id: string) => id !== "lost-look" }));

vi.mock("@/app/actions/media-generation", () => ({ requestMediaGenerationAction: vi.fn(), getMediaGenerationAction: vi.fn() }));

function film(): VideoDocument {
  const doc = emptyVideoDocument("story");
  doc.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", "vid-1", 0, 4000), id: "c1" }] }];
  doc.durationMs = 4000;
  return doc;
}

function setup() {
  const runtime = createVideoEditorRuntime(film());
  const presence = createAgentPresence();
  seenDuringCapture.read = () => presence.store.getState();
  const follower = new AgentFollower({ view: runtime.view, seek: (ms) => runtime.playback.seek(ms), frames: { request: () => 0, cancel: () => undefined }, now: () => 0, reduceMotion: () => true });
  const exporter = createVideoExporter({
    document: () => runtime.store.getState().document,
    commit: () => runtime.store.getState().commitTransaction(),
    flush: async () => undefined,
    committed: () => ({ version: 1, settled: true }),
    lutReadable: async () => true,
    local: () => new Promise(() => undefined),
    refreshLibrary: () => undefined,
  });
  const agent = createVideoAgent({ editor: runtime, exporter, presence, follower, captionTrackName: "Legendas", label: (action) => action, reduceMotion: () => true });
  return { runtime, presence, look: (args: unknown) => agent({ id: "cmd", name: "look", projectId: "p-1", args }) };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Elo looking at the video", () => {
  it("refuses to look at frames that use a LUT that cannot be read, naming the clip, and draws nothing without it", async () => {
    const { runtime, look } = setup();
    runtime.store.getState().apply((doc) => ({ ...doc, tracks: [{ ...doc.tracks[0], clips: [{ ...doc.tracks[0].clips[0], name: "Abertura", color: { lut: { assetId: "lost-look" } } }] }] }));
    vi.mocked(captureVideo).mockClear();
    const reply = await look({ from_ms: 0, to_ms: 1000, count: 2 });
    expect(reply).toMatchObject({ ok: false, error: { code: "lut_unavailable" } });
    expect(JSON.stringify(reply)).toContain("c1 (Abertura)");
    expect(captureVideo).not.toHaveBeenCalled();
  });

  it("marks the sampled moments on the timeline and outlines the zoomed part of the preview while she looks", async () => {
    const timeline = placed("data-studio-timeline", { left: 0, top: 500, width: 1000, height: 200 });
    placed("data-studio-lanes", { left: 0, top: 540, width: 4000, height: 160 }, timeline);
    placed("data-studio-preview-frame", { left: 200, top: 40, width: 400, height: 300 });
    const { runtime, presence, look } = setup();
    runtime.view.setState({ pxPerSecond: 100 });
    const reply = await look({ from_ms: 1000, to_ms: 2001, count: 3, region: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } });
    expect(reply).toMatchObject({ ok: true, images: [SHEET], target: { kind: "moments", fromMs: 1000, toMs: 2000 } });
    const state = seenDuringCapture.state!;
    expect(state).toMatchObject({ visible: true, label: "look", outline: { left: 300, top: 115, width: 200, height: 150 } });
    expect(state.ticks.map((tick) => tick.left + tick.width / 2)).toEqual([100, 150, 200]);
    expect(presence.shots.store.getState().shots[0]).toMatchObject({ image: SHEET, target: { kind: "moments", fromMs: 1000, toMs: 2000 } });
  });

  it("keeps the timeline unmarked while a group is open, since its lanes show another clock", async () => {
    const timeline = placed("data-studio-timeline", { left: 0, top: 500, width: 1000, height: 200 });
    placed("data-studio-lanes", { left: 0, top: 540, width: 4000, height: 160 }, timeline);
    const { runtime, look } = setup();
    runtime.view.setState({ groupPath: ["g-1"] });
    await look({ times_ms: [500] });
    expect(seenDuringCapture.state!.ticks).toEqual([]);
  });

  it("passes the wireframe and guides views to the capture and refuses a view it does not know", async () => {
    const { look } = setup();
    vi.mocked(captureVideo).mockClear();
    expect(await look({ count: 1, view: "guides" })).toMatchObject({ ok: true, data: { view: "guides" } });
    expect(vi.mocked(captureVideo).mock.calls[0][1]).toMatchObject({ view: "guides" });
    expect(await look({ count: 1 })).toMatchObject({ ok: true, data: expect.not.objectContaining({ view: expect.anything() }) });
    expect(await look({ count: 1, view: "xray" })).toMatchObject({ ok: false, error: { code: "invalid_view" } });
  });

  it("brings measured motion problems into every look as alerts and the whole motion report into a look at a window", async () => {
    const { runtime, look } = setup();
    const jumpy = { ...newOverlayClip({ id: "t-layer", type: "text", text: "Pulo", fontSize: 0.05, fill: "#ffffff", transform: { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 } }, 0, 4000), id: "t1", keyframes: { x: [{ atMs: 1000, value: 0.2, easing: "linear" as const }, { atMs: 1033, value: 0.8, easing: "linear" as const }] } };
    runtime.store.getState().apply((doc) => ({ ...doc, tracks: [{ ...doc.tracks[0], clips: [...doc.tracks[0].clips, jumpy] }] }));
    expect(await look({ count: 2 })).toMatchObject({ ok: true, data: { alerts: [expect.stringMatching(/^aviso: t1 \("Pulo"\) salta/)] } });
    const windowed = await look({ from_ms: 800, to_ms: 1400, count: 3 });
    expect(windowed).toMatchObject({ ok: true, data: { motion_report: { moves: [expect.stringMatching(/^t1 \(texto "Pulo"\): x 0.2→0.8/)], findings: [expect.stringMatching(/salta/)] } } });
  });

  it("reads the light at each sampled frame with the depth view and draws its marks on each frame", async () => {
    const { runtime, look } = setup();
    const shadowed = (id: string, y: number, startMs: number) => ({ ...newOverlayClip({ id: `${id}-layer`, type: "text", text: id, fontSize: 0.05, fill: "#ffffff", transform: { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 } }, startMs, 4000 - startMs, { x: 0.5, y: 0.3 + startMs / 10000, w: 0.6, h: 0.08, rotation: 0, opacity: 1 }), id, effects: [{ id: "d", type: "drop-shadow" as const, color: "#000000", opacity: 0.4, x: 0, y, blur: 10, spread: 0 }] });
    runtime.store.getState().apply((doc) => ({ ...doc, tracks: [{ ...doc.tracks[0], clips: [...doc.tracks[0].clips, shadowed("a", 10, 0), shadowed("b", 10, 0), shadowed("c", -10, 0)] }] }));
    vi.mocked(captureVideo).mockClear();
    const reply = await look({ times_ms: [500, 1500], view: "depth" });
    expect(reply).toMatchObject({ ok: true, data: { view: "depth", depth: [{ at_ms: 500, findings: [expect.stringMatching(/^aviso: a sombra de c cai para cima/)] }, { at_ms: 1500 }] } });
    const shapes = vi.mocked(captureVideo).mock.calls[0][1].shapes!;
    expect(shapes).toHaveLength(2);
    expect(shapes[0].filter((shape) => shape.kind === "arrow")).toHaveLength(3);
  });

  it("names a library media it looked at and keeps that picture too", async () => {
    const { runtime, presence, look } = setup();
    runtime.assets.sourceDuration = vi.fn(async () => 10_000);
    expect(await look({ media_id: "vid-1", count: 2 })).toMatchObject({ ok: true, target: { kind: "media" } });
    expect(presence.shots.store.getState().shots).toHaveLength(1);
  });

  it("seeks the film to the first moment she looked at, when the reader asks", () => {
    const { runtime } = setup();
    const reveal = createVideoReveal(runtime);
    reveal({ kind: "moments", fromMs: 2500, toMs: 3500 });
    expect(runtime.view.getState().playheadMs).toBe(2500);
    reveal({ kind: "artboards" });
    expect(runtime.view.getState().playheadMs).toBe(2500);
  });
});
