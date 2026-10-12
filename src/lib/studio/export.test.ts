import { describe, expect, it, vi } from "vitest";

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "./document";
import { EXPORT_FAILURES, isExportOutdated, startVideoExport, type ExportDeps, type ExportPhase, type LocalExport } from "./export";

function doc(): VideoDocument {
  const d = emptyVideoDocument("portrait");
  d.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", "img", 0, 2000), id: "i" }] }];
  d.durationMs = 2000;
  return d;
}

const result = { mediaId: "m-1", mediaUrl: "https://cdn/m-1.mp4" };
const exported: LocalExport = { status: "done", result };

function deps(overrides: Partial<ExportDeps> = {}): ExportDeps {
  return {
    flush: vi.fn(async () => undefined),
    committed: () => ({ version: 5, settled: true }),
    document: () => doc(),
    local: vi.fn(async () => exported),
    lutReadable: async () => true,
    ...overrides,
  };
}

describe("startVideoExport", () => {
  it("saves, then renders and uploads in the browser, reporting each phase", async () => {
    const saved = doc();
    const local = vi.fn(async (_doc: VideoDocument, onPhase: (phase: ExportPhase) => void) => {
      onPhase({ phase: "encoding", done: 30, total: 60 });
      onPhase({ phase: "uploading" });
      return exported;
    });
    const d = deps({ document: () => saved, local });
    const phases: ExportPhase[] = [];
    d.onPhase = (phase) => phases.push(phase);
    expect(await startVideoExport(d)).toEqual({ status: "done", result, document: saved });
    expect(d.flush).toHaveBeenCalled();
    expect(local).toHaveBeenCalledWith(saved, expect.any(Function));
    expect(phases).toEqual([{ phase: "saving" }, { phase: "encoding", done: 30, total: 60 }, { phase: "uploading" }]);
  });

  it("reports why the browser could not export, with no other way out", async () => {
    for (const reason of EXPORT_FAILURES.filter((code) => code !== "lut_unavailable")) {
      const d = deps({ local: vi.fn(async () => ({ status: "failed" as const, reason })) });
      expect(await startVideoExport(d)).toEqual({ status: "failed", code: reason });
    }
  });

  it("stops before rendering when the save did not settle or the timeline is empty", async () => {
    const unsaved = deps({ committed: () => ({ version: 5, settled: false }) });
    expect(await startVideoExport(unsaved)).toEqual({ status: "failed", code: "unsaved" });
    expect(unsaved.local).not.toHaveBeenCalled();
    const empty = doc();
    empty.durationMs = 0;
    const blank = deps({ document: () => empty });
    expect(await startVideoExport(blank)).toEqual({ status: "failed", code: "empty" });
    expect(blank.local).not.toHaveBeenCalled();
  });

  it("refuses before rendering when a LUT a clip uses cannot be read, naming that clip", async () => {
    const looked = doc();
    looked.tracks[0].clips[0] = { ...looked.tracks[0].clips[0], color: { lut: { assetId: "teal" } } };
    const d = deps({ document: () => looked, lutReadable: async (id) => id !== "teal" });
    expect(await startVideoExport(d)).toEqual({ status: "failed", code: "lut_unavailable", clip: looked.tracks[0].clips[0] });
    expect(d.local).not.toHaveBeenCalled();
  });

  it("names the clip when the renderer loses a LUT mid export, and fails plainly when no clip can be named", async () => {
    const looked = doc();
    looked.tracks[0].clips[0] = { ...looked.tracks[0].clips[0], color: { lut: { assetId: "teal" } } };
    let reads = 0;
    const lost = deps({ document: () => looked, lutReadable: async () => ++reads === 1, local: vi.fn(async () => ({ status: "failed" as const, reason: "lut_unavailable" as const })) });
    expect(await startVideoExport(lost)).toEqual({ status: "failed", code: "lut_unavailable", clip: looked.tracks[0].clips[0] });
    const unnamed = deps({ local: vi.fn(async () => ({ status: "failed" as const, reason: "lut_unavailable" as const })) });
    expect(await startVideoExport(unnamed)).toEqual({ status: "failed", code: "failed" });
  });
});

describe("an export result belongs to the timeline it rendered", () => {
  it("is current until the timeline changes, then outdated", () => {
    const rendered = doc();
    expect(isExportOutdated(rendered, rendered)).toBe(false);
    expect(isExportOutdated(rendered, { ...rendered, durationMs: 3000 })).toBe(true);
  });
});
