import { describe, expect, it, vi } from "vitest";

import { defaultVideoExport, MP4_EXPORT, type VideoExportRequest } from "@/lib/studio/animated-export";
import { emptyVideoDocument, newMediaClip } from "@/lib/studio/document";
import type { LocalExport } from "@/lib/studio/export";

import { createVideoExporter, exportStatus, exportSummary } from "./video-exporter";

function setup(local: () => Promise<LocalExport>) {
  const document = { ...emptyVideoDocument("story"), durationMs: 2000 };
  const refreshLibrary = vi.fn();
  const asked: VideoExportRequest[] = [];
  const exporter = createVideoExporter({
    document: () => document,
    commit: vi.fn(),
    flush: async () => undefined,
    committed: () => ({ version: 3, settled: true }),
    lutReadable: async () => true,
    local: async (_, request, onPhase) => {
      asked.push(request);
      onPhase({ phase: "encoding", done: 1, total: 2 });
      return local();
    },
    refreshLibrary,
  });
  return { exporter, document, refreshLibrary, asked };
}

describe("video exporter", () => {
  it("runs one export at a time and keeps the result for the button and for Elo", async () => {
    let finish: (value: LocalExport) => void = () => undefined;
    const { exporter, document, refreshLibrary, asked } = setup(() => new Promise((resolve) => (finish = resolve)));
    const running = exporter.start();
    await Promise.resolve();
    expect(exporter.busy()).toBe(true);
    expect(exportStatus(exporter.store.getState(), document)).toMatchObject({ status: "preparing", request: MP4_EXPORT });
    await exporter.start();
    await vi.waitFor(() => expect(asked).toEqual([MP4_EXPORT]));
    finish({ status: "done", result: { mediaId: "m-1", mediaUrl: "https://x/m-1.mp4" } });
    await running;
    expect(asked).toEqual([MP4_EXPORT]);
    expect(exporter.busy()).toBe(false);
    expect(exportStatus(exporter.store.getState(), document)).toEqual({ status: "done", result: { mediaId: "m-1", mediaUrl: "https://x/m-1.mp4" }, outdated: false, request: MP4_EXPORT });
    expect(exportStatus(exporter.store.getState(), { ...document })).toMatchObject({ outdated: true });
    expect(refreshLibrary).toHaveBeenCalledTimes(1);
    expect(exportSummary(exportStatus(exporter.store.getState(), document))).toEqual({ status: "done", format: "mp4", media_id: "m-1", url: "https://x/m-1.mp4", outdated: false });
    expect(exportSummary({ status: "preparing", phase: { phase: "encoding", done: 1, total: 4 }, request: MP4_EXPORT })).toEqual({ status: "preparing", format: "mp4", phase: "encoding", progress: 0.25 });
  });

  it("exports the format it was asked for and remembers it", async () => {
    const gif = defaultVideoExport("gif", { width: 1080, height: 1920 });
    const { exporter, document, asked } = setup(async () => ({ status: "done", result: { mediaId: "g-1", mediaUrl: "https://x/g-1.gif" } }));
    await exporter.start(gif);
    expect(asked).toEqual([gif]);
    expect(exportStatus(exporter.store.getState(), document)).toMatchObject({ status: "done", request: gif });
    expect(exportSummary(exportStatus(exporter.store.getState(), document))).toMatchObject({ format: "gif", media_id: "g-1" });
  });

  it("tells Elo which range or which moment an export covers", () => {
    const ranged: VideoExportRequest = { format: "mp4", range: { startMs: 1000, endMs: 3000 } };
    const frame: VideoExportRequest = { format: "png", atMs: 1500 };
    const result = { mediaId: "m-2", mediaUrl: "https://x/m-2" };
    expect(exportSummary({ status: "done", result, outdated: false, request: ranged })).toEqual({ status: "done", format: "mp4", from_ms: 1000, to_ms: 3000, media_id: "m-2", url: "https://x/m-2", outdated: false });
    expect(exportSummary({ status: "failed", code: "out_of_range", request: frame })).toEqual({ status: "failed", format: "png", at_ms: 1500, code: "out_of_range" });
    expect(exportSummary({ status: "preparing", phase: { phase: "saving" }, request: frame })).toEqual({ status: "preparing", format: "png", at_ms: 1500, phase: "saving" });
  });

  it("reports a failure with its format and clears it on reset", async () => {
    const webp = defaultVideoExport("webp", { width: 1080, height: 1920 });
    const { exporter, document } = setup(async () => ({ status: "failed", reason: "no_encoder" }) as LocalExport);
    await exporter.start(webp);
    expect(exportStatus(exporter.store.getState(), document)).toEqual({ status: "failed", code: "no_encoder", request: webp });
    expect(exportSummary(exportStatus(exporter.store.getState(), document))).toEqual({ status: "failed", format: "webp", code: "no_encoder" });
    exporter.reset();
    expect(exportStatus(exporter.store.getState(), document)).toEqual({ status: "idle" });
  });

  it("keeps the clip whose LUT could not be read so the button and Elo can name it", async () => {
    const document = { ...emptyVideoDocument("story"), durationMs: 2000 };
    const clip = { ...newMediaClip("video", "film", 0, 2000), id: "shot", color: { lut: { assetId: "teal" } } };
    document.tracks = [{ id: "v1", kind: "visual", clips: [clip] }];
    const local = vi.fn(async (): Promise<LocalExport> => ({ status: "done", result: { mediaId: "m", mediaUrl: "u" } }));
    const exporter = createVideoExporter({ document: () => document, commit: vi.fn(), flush: async () => undefined, committed: () => ({ version: 3, settled: true }), lutReadable: async () => false, local, refreshLibrary: vi.fn() });
    await exporter.start();
    expect(local).not.toHaveBeenCalled();
    expect(exportStatus(exporter.store.getState(), document)).toEqual({ status: "failed", code: "lut_unavailable", request: MP4_EXPORT, clip });
    expect(exportSummary(exportStatus(exporter.store.getState(), document))).toEqual({ status: "failed", format: "mp4", code: "lut_unavailable", clip_id: "shot" });
    exporter.reset();
    expect(exportStatus(exporter.store.getState(), document)).toEqual({ status: "idle" });
  });
});
