import { describe, expect, it } from "vitest";

import { fittedTransform } from "./geometry";
import { clipJobState, imageJobOverlays, overlayLabelKey, pendingMediaJobs, PILL, pillWidth, placeholderTransform, placePill, readClipJobState, videoJobOverlays } from "./job-overlay";

describe("overlays derived from image editor jobs", () => {
  it("shows a running, finishing or failed job on the layer it targets", () => {
    const jobs = [
      { id: "a", purpose: "cutout", layerId: "l1", settling: false, error: null },
      { id: "b", purpose: "edit", layerId: "l2", settling: true, error: null },
      { id: "c", purpose: "cutout", layerId: "l3", settling: false, error: "provider_busy" },
    ];
    expect(imageJobOverlays(jobs)).toEqual([
      { jobId: "a", targetId: "l1", purpose: "cutout", phase: "running", error: null, references: [] },
      { jobId: "b", targetId: "l2", purpose: "edit", phase: "settling", error: null, references: [] },
      { jobId: "c", targetId: "l3", purpose: "cutout", phase: "failed", error: "provider_busy", references: [] },
    ]);
  });

});

describe("placing the status pill by the element's size on screen", () => {
  const bounds = { width: 1200, height: 800 };
  const boxAt = (left: number, top: number, width: number, height: number, rotation = 0) => ({ transform: { x: (left + width / 2) / 1000, y: (top + height / 2) / 1000, w: width / 1000, h: height / 1000, rotation, opacity: 1 }, frame: { left: 0, top: 0, width: 1000, height: 1000 } });
  const text = "Removendo o fundo...";

  it("keeps the pill inside a large box, centered near its bottom", () => {
    const { transform, frame } = boxAt(100, 100, 400, 300);
    const layout = placePill(transform, frame, text, bounds);
    expect(layout.mode).toBe("inside");
    expect(layout.inside.left).toBeCloseTo((400 - layout.width) / 2);
    expect(layout.inside.top).toBe(300 - PILL.margin - PILL.height);
  });

  it("anchors the pill just below a box too narrow for it, or above when there is no room below", () => {
    const narrow = boxAt(300, 200, 90, 120);
    const below = placePill(narrow.transform, narrow.frame, text, bounds);
    expect(below.mode).toBe("outside");
    expect(below.outside).toMatchObject({ side: "below", top: 320 + PILL.gap });
    const low = boxAt(300, 700, 90, 80);
    expect(placePill(low.transform, low.frame, text, bounds).outside).toMatchObject({ side: "above", top: 700 - PILL.gap - PILL.height });
  });

  it("follows zoom: the same layer fits at full zoom and moves outside when zoomed out", () => {
    const { transform } = boxAt(100, 100, 200, 120);
    expect(placePill(transform, { left: 0, top: 0, width: 1000, height: 1000 }, text, bounds).mode).toBe("inside");
    expect(placePill(transform, { left: 0, top: 0, width: 400, height: 400 }, text, bounds).mode).toBe("outside");
  });

  it("shows only the spinner on a very small box, with the outside spot ready for the full status", () => {
    const tiny = boxAt(500, 500, 30, 30);
    const layout = placePill(tiny.transform, tiny.frame, text, bounds);
    expect(layout.mode).toBe("spinner");
    expect(layout.outside.side).toBe("below");
  });

  it("measures a rotated box by its corners and clamps the pill to the visible area", () => {
    const tilted = boxAt(1100, 300, 200, 40, 90);
    const layout = placePill(tilted.transform, tilted.frame, text, bounds);
    expect(layout.mode).toBe("outside");
    expect(layout.outside.top).toBeCloseTo(320 + 100 + PILL.gap);
    expect(layout.outside.left).toBe(bounds.width - layout.width - PILL.margin);
  });

  it("never wraps: the pill grows with its text", () => {
    expect(pillWidth("Gerando imagem...")).toBeLessThan(pillWidth("Removendo o fundo da imagem..."));
  });
});

describe("placeholders for results that will become new layers", () => {
  it("shows a generation where the result will land, at the requested aspect, and marks its references", () => {
    const entries = imageJobOverlays([{ id: "g", purpose: "generate", layerId: null, settling: false, error: null, created: { aspect: "landscape", referenceMediaIds: ["foto"] } }]);
    expect(entries).toEqual([{ jobId: "g", targetId: null, purpose: "generate", phase: "running", error: null, aspect: "landscape", references: ["foto"] }]);
    expect(placeholderTransform("landscape", { width: 1000, height: 1000 })).toEqual(fittedTransform(1920, 1080, { width: 1000, height: 1000 }));
  });

  it("waits for the job to know its aspect before drawing a placeholder", () => {
    expect(imageJobOverlays([{ id: "g", purpose: "generate", layerId: null, settling: false, error: null, created: null }])).toEqual([]);
  });
});

describe("overlays derived from video editor jobs", () => {
  const job = (patch: object) => ({ id: "j", purpose: "cutout", target: { clipId: "c1" }, state: "running", settling: false, error: null, ...patch });

  it("shows clip jobs while they run and when they fail, and nothing once done", () => {
    expect(videoJobOverlays([job({})])).toEqual([{ jobId: "j", targetId: "c1", purpose: "cutout", phase: "running", error: null, references: [] }]);
    expect(videoJobOverlays([job({ settling: true })])[0].phase).toBe("settling");
    expect(videoJobOverlays([job({ state: "failed", error: { code: "timed_out", message: "" } })])[0]).toMatchObject({ phase: "failed", error: "timed_out" });
    expect(videoJobOverlays([job({ state: "done" })])).toEqual([]);
    expect(videoJobOverlays([job({ target: { atMs: 0 } })])).toEqual([]);
  });

  it("names the newest job on a clip for the timeline bar as a stable string", () => {
    const jobs = [job({ id: "old", state: "failed", error: { code: "x", message: "" } }), job({ id: "new" })];
    expect(clipJobState(jobs, "c1")).toBe("new:running");
    expect(clipJobState(jobs, "c2")).toBeNull();
    expect(readClipJobState("job:a1:settling")).toEqual({ jobId: "job:a1", phase: "settling" });
  });
});

describe("the status words for a job", () => {
  it("picks the running, finishing or failure message key", () => {
    expect(overlayLabelKey("running", "cutout", "running")).toBe("running.cutout");
    expect(overlayLabelKey("running", "denoise", "generating")).toBe("generating.denoise");
    expect(overlayLabelKey("settling", "cutout", "running")).toBe("finalizing");
    expect(overlayLabelKey("failed", "cutout", "generating")).toBe("failed.cutout");
  });
});

describe("media items with a job still running on them", () => {
  const entry = (patch: object) => ({ jobId: "j", targetId: "c1", purpose: "cutout", phase: "running" as const, error: null, references: [], ...patch });
  const assets: Record<string, string> = { c1: "foto-1", c2: "audio-1" };

  it("maps each pending job to the media of the item it works on", () => {
    const marks = pendingMediaJobs([entry({}), entry({ jobId: "k", targetId: "c2", purpose: "denoise", phase: "settling" })], (id) => assets[id]);
    expect([...marks.keys()]).toEqual(["foto-1", "audio-1"]);
    expect(marks.get("audio-1")).toMatchObject({ purpose: "denoise", phase: "settling" });
  });

  it("leaves out failed jobs, jobs without a target and items without media", () => {
    expect(pendingMediaJobs([entry({ phase: "failed" }), entry({ targetId: null }), entry({ targetId: "gone" })], (id) => assets[id]).size).toBe(0);
  });
});
