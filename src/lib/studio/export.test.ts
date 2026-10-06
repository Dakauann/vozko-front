import { describe, expect, it, vi } from "vitest";

import type { MediaGenerationJob } from "@/lib/media-generation/types";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type VideoDocument } from "./document";
import { isExportOutdated, rasterTargets, startVideoExport, type ExportDeps } from "./export";

const job: MediaGenerationJob = { id: "job-1", kind: "video", status: "queued", referenceMediaIds: [], createdAt: "", updatedAt: "" };

function doc(): VideoDocument {
  const d = emptyVideoDocument("portrait");
  const title = { ...newOverlayClip(newTextLayer("Oi"), 0, 1000, { x: 0.5, y: 0.5, w: 0.5, h: 0.1, rotation: 0, opacity: 1 }), id: "o1" };
  const hidden = { ...newOverlayClip(newTextLayer("Escondido"), 0, 1000), id: "o2" };
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", "img", 0, 2000), id: "i" }] },
    { id: "v2", kind: "visual", clips: [title] },
    { id: "v3", kind: "visual", hidden: true, clips: [hidden] },
  ];
  d.durationMs = 2000;
  return d;
}

function deps(overrides: Partial<ExportDeps> = {}): ExportDeps {
  return {
    flush: vi.fn(async () => undefined),
    committed: () => ({ version: 5, settled: true }),
    document: () => doc(),
    rasterize: vi.fn(async () => new Blob(["png"], { type: "image/png" })),
    upload: vi.fn(async () => ({ data: { mediaId: "raster-1" } })),
    requestExport: vi.fn(async () => ({ data: job })),
    cache: new Map(),
    ...overrides,
  };
}

describe("raster targets", () => {
  it("lists overlays on visible tracks at output resolution", () => {
    const targets = rasterTargets(doc());
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ clipId: "o1", widthPx: 540, heightPx: 135, fontBasePx: 1350 });
  });

  it("gives equal looks the same key whatever the layer id", () => {
    const a = doc();
    const b = doc();
    b.tracks[1].clips[0].layer = { ...b.tracks[1].clips[0].layer!, id: "other" };
    expect(rasterTargets(a)[0].key).toBe(rasterTargets(b)[0].key);
  });
});

describe("startVideoExport", () => {
  it("saves, rasterizes, uploads and exports the saved version", async () => {
    const exported = doc();
    const d = deps({ document: () => exported });
    const phases: string[] = [];
    d.onPhase = (p) => phases.push(p.phase);
    const result = await startVideoExport(d);
    expect(result).toEqual({ status: "started", job, document: exported });
    expect(d.flush).toHaveBeenCalled();
    expect(d.rasterize).toHaveBeenCalledTimes(1);
    expect(d.requestExport).toHaveBeenCalledWith(5, { o1: "raster-1" });
    expect(phases).toEqual(["saving", "rasterizing", "submitting"]);
  });

  it("reuses an uploaded raster for an unchanged overlay", async () => {
    const d = deps();
    await startVideoExport(d);
    await startVideoExport(d);
    expect(d.upload).toHaveBeenCalledTimes(1);
    expect(d.requestExport).toHaveBeenLastCalledWith(5, { o1: "raster-1" });
  });

  it("stops when the save did not settle", async () => {
    const d = deps({ committed: () => ({ version: 5, settled: false }) });
    expect(await startVideoExport(d)).toEqual({ status: "failed", code: "unsaved" });
    expect(d.requestExport).not.toHaveBeenCalled();
  });

  it("refuses an empty timeline", async () => {
    const d = deps({ document: () => emptyVideoDocument("square") });
    expect(await startVideoExport(d)).toEqual({ status: "failed", code: "empty" });
  });

  it("stops on a raster or upload failure", async () => {
    const broken = deps({ rasterize: vi.fn(async () => Promise.reject(new Error("font"))) });
    expect(await startVideoExport(broken)).toEqual({ status: "failed", code: "raster_failed", message: "font" });
    const offline = deps({ upload: vi.fn(async () => ({ error: "offline" })) });
    expect(await startVideoExport(offline)).toEqual({ status: "failed", code: "upload_failed", message: "offline" });
    expect(offline.requestExport).not.toHaveBeenCalled();
  });

  it("maps the export errors", async () => {
    const respond = (error: object) => deps({ requestExport: vi.fn(async () => error as { error: string }) });
    expect(await startVideoExport(respond({ error: "x", status: 409, code: "version_conflict" }))).toEqual({ status: "conflict" });
    expect(await startVideoExport(respond({ error: "x", status: 429, code: "too_many_jobs" }))).toMatchObject({ status: "failed", code: "too_many_jobs" });
    expect(await startVideoExport(respond({ error: "x", status: 422, code: "invalid_request" }))).toMatchObject({ status: "failed", code: "invalid" });
    expect(await startVideoExport(respond({ error: "x", status: 402, code: "insufficient_funds" }))).toMatchObject({ status: "failed", code: "insufficient_funds" });
  });

  it("forgets cached rasters the server could not use", async () => {
    const d = deps();
    await startVideoExport(d);
    d.requestExport = vi.fn(async () => ({ error: "x", status: 422, code: "not_rasterized" }));
    expect(await startVideoExport(d)).toMatchObject({ status: "failed", code: "not_rasterized" });
    expect(d.cache.size).toBe(0);
  });
});

describe("disabled overlays", () => {
  it("need no raster", () => {
    const d = doc();
    d.tracks[1].clips[0] = { ...d.tracks[1].clips[0], disabled: true };
    expect(rasterTargets(d)).toEqual([]);
  });
});

describe("an export result belongs to the timeline it rendered", () => {
  it("is current until the timeline changes, then outdated", () => {
    const rendered = doc();
    expect(isExportOutdated(rendered, rendered)).toBe(false);
    expect(isExportOutdated(rendered, { ...rendered, durationMs: 3000 })).toBe(true);
  });
});
