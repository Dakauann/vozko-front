import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

const tracked = vi.hoisted(() => ({ outcome: null as unknown, requests: [] as unknown[] }));

vi.mock("@/components/studio/media/point-tracker", () => ({
  trackAssetPoint: vi.fn(async (_assetId: string, request: unknown, watch: { onProgress?: (done: number) => void }) => {
    tracked.requests.push(request);
    watch.onProgress?.(0.5);
    return tracked.outcome;
  }),
  trackWithin: vi.fn(),
}));

import ptMessages from "@/i18n/messages/pt.json";
import { emptyVideoDocument, newMediaClip, newTextLayer, type VideoDocument } from "@/lib/studio/document";
import { overlayClip } from "@/lib/studio/media-clips";
import type { PointTracker } from "@/lib/studio/point-track";
import { findClip } from "@/lib/studio/timeline";
import type { TrackOutcome } from "@/lib/studio/tracking/track-outcome";

import { Inspector } from "../inspector/inspector";
import { Preview } from "../preview/preview";
import { renderInEditor, stubPreviewLayout } from "./harness";

const pt = ptMessages.studio.video.tracking;

const SAMPLES = Array.from({ length: 30 }, (_, n) => ({ atMs: Math.round((n * 1000) / 30), x: 0.3 + n * 0.005, y: 0.5, confidence: 0.97 }));

const OUTCOME: TrackOutcome = { kind: "tracked", frameWidth: 1080, frameHeight: 1920, size: 0.06, referenceMs: 0, loss: null, samples: SAMPLES };

const TRACKER: PointTracker = { id: "pt-1", frameWidth: 1080, frameHeight: 1920, size: 0.06, referenceMs: 0, samples: SAMPLES };

function doc(trackers: PointTracker[] = [], tagged = true): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks[0].clips = [{ ...newMediaClip("video", "m-1", 0, 1000), id: "shot", ...(trackers.length ? { trackers } : {}) }];
  d.tracks[1].clips = tagged ? [{ ...overlayClip(newTextLayer("Oi"), 0), id: "tag", durationMs: 1000, transform: { x: 0.5, y: 0.3, w: 0.3, h: 0.05, rotation: 0, opacity: 1 } }] : [];
  d.durationMs = 1000;
  return d;
}

afterEach(() => {
  tracked.requests = [];
  vi.clearAllMocks();
});

describe("tracking by hand", () => {
  it("aims the target box in the preview, tracks with progress and stores the point", { timeout: 15_000 }, async () => {
    tracked.outcome = OUTCOME;
    const restore = stubPreviewLayout({ area: { width: 498, height: 848 }, frame: { width: 450, height: 800 } });
    try {
      const { editor, container } = renderInEditor(doc([], false), <Preview />);
      act(() => editor.commands.startTracking("shot"));
      const aim = container.querySelector<HTMLElement>("[data-track-aim]")!;
      fireEvent.pointerDown(aim, { button: 0, pointerId: 1, clientX: 135, clientY: 400 });
      fireEvent.pointerMove(aim, { pointerId: 1, clientX: 135, clientY: 440 });
      fireEvent.pointerUp(aim, { pointerId: 1, clientX: 135, clientY: 440 });
      const tool = editor.view.getState().trackTool!;
      expect(tool.point).toEqual({ x: 0.3, y: 0.5 });
      expect(tool.size).toBeCloseTo(0.1, 9);
      expect(container.querySelector("[data-track-box]")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: pt.direction.forward }));
      fireEvent.click(screen.getByRole("button", { name: pt.run }));
      await waitFor(() => expect(findClip(editor.store.getState().document, "shot")!.clip.trackers).toHaveLength(1));
      expect(tracked.requests[0]).toMatchObject({ direction: "forward", boxPoint: { x: 0.3, y: 0.5 } });
      expect(editor.view.getState().trackTool).toBeNull();
      act(() => editor.store.getState().select(["shot"]));
      expect(container.querySelector('[data-track-paths="shot"] polyline')).toBeTruthy();
    } finally {
      restore();
    }
  });

  it("refuses a lost track and keeps the tracked part when asked", { timeout: 15_000 }, async () => {
    tracked.outcome = { ...OUTCOME, samples: SAMPLES.slice(0, 10), loss: { direction: "forward", atMs: 333, confidence: 0.4 } };
    const restore = stubPreviewLayout({ area: { width: 498, height: 848 }, frame: { width: 450, height: 800 } });
    try {
      const { editor } = renderInEditor(doc([], false), <Preview />);
      act(() => {
        editor.commands.startTracking("shot");
        editor.commands.aimTracking({ x: 0.3, y: 0.5 }, 0.06);
      });
      fireEvent.click(screen.getByRole("button", { name: pt.run }));
      await waitFor(() => expect(screen.getByRole("button", { name: pt.keepPartial })).toBeTruthy());
      expect(findClip(editor.store.getState().document, "shot")!.clip.trackers).toBeUndefined();
      expect(editor.view.getState().notice?.key).toBe("tracking.lost");
      fireEvent.click(screen.getByRole("button", { name: pt.keepPartial }));
      expect(findClip(editor.store.getState().document, "shot")!.clip.trackers![0].samples).toHaveLength(10);
    } finally {
      restore();
    }
  });

  it("makes a clip follow a point, stabilizes and removes the point from the inspector", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc([TRACKER]), <Inspector />);
    act(() => editor.store.getState().select(["shot"]));
    fireEvent.click(screen.getByRole("tab", { name: ptMessages.studio.inspector.groups.animation }));
    expect(screen.getAllByText(pt.point.replace("{n}", "1")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: pt.attach }));
    expect(findClip(editor.store.getState().document, "tag")!.clip).toMatchObject({ parentId: "shot", parentTracker: "pt-1" });
    fireEvent.click(screen.getByRole("button", { name: pt.stabilize }));
    expect(findClip(editor.store.getState().document, "shot")!.clip.stabilize?.zoom).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole("button", { name: pt.unstabilize }));
    expect(findClip(editor.store.getState().document, "shot")!.clip.stabilize).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: pt.remove }));
    expect(findClip(editor.store.getState().document, "shot")!.clip.trackers).toBeUndefined();
    expect(findClip(editor.store.getState().document, "tag")!.clip.parentTracker).toBeUndefined();
  });

  it("starts the track tool from the inspector", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["shot"]));
    fireEvent.click(screen.getByRole("tab", { name: ptMessages.studio.inspector.groups.animation }));
    fireEvent.click(screen.getByRole("button", { name: pt.trackPoint }));
    expect(editor.view.getState().trackTool).toMatchObject({ clipId: "shot", point: null });
  });
});
