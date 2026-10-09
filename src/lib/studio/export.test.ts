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
    for (const reason of EXPORT_FAILURES) {
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
});

describe("an export result belongs to the timeline it rendered", () => {
  it("is current until the timeline changes, then outdated", () => {
    const rendered = doc();
    expect(isExportOutdated(rendered, rendered)).toBe(false);
    expect(isExportOutdated(rendered, { ...rendered, durationMs: 3000 })).toBe(true);
  });
});
