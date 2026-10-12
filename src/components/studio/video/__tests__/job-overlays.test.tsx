import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/media-generation", () => ({
  requestMediaGenerationAction: vi.fn(() => new Promise<never>(() => undefined)),
  getMediaGenerationAction: vi.fn(() => new Promise<never>(() => undefined)),
  listMediaModelsAction: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import ptMessages from "@/i18n/messages/pt.json";
import type { MediaGenerationJob } from "@/lib/media-generation/types";
import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";
import { OVERLAY_FAILURE_MS } from "@/lib/studio/job-overlay";

import { VideoJobOverlays } from "../job-overlays";
import { VideoElementGenerator } from "../panels/element-generator";
import { MediaPanel } from "../panels/media-panel";
import { ProcessPanel } from "../panels/process-panel";
import { Timeline } from "../timeline/timeline";
import { renderInEditor } from "./harness";

const job: MediaGenerationJob = { id: "srv-1", kind: "cutout", status: "queued", referenceMediaIds: [], sourceMediaId: "foto-1", createdAt: "2026-10-11T00:00:00Z", updatedAt: "2026-10-11T00:00:00Z" };

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", "foto-1", 1000, 2000), id: "img" }] }];
  d.durationMs = 4000;
  return d;
}

const overlay = () => document.querySelector<HTMLElement>('[data-job-overlay="img"]');
const bar = () => document.querySelector<HTMLElement>('[data-clip-id="img"] [data-job-bar]');

afterEach(() => {
  vi.useRealTimers();
});

describe("the in-progress overlay on a video clip", () => {
  it("covers the clip in the preview while the playhead is over it, for a job Elo started", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <div className="relative"><VideoJobOverlays /></div>);
    act(() => editor.view.setState({ previewContainer: { width: 540, height: 960 }, playheadMs: 1500 }));
    act(() => void editor.commands.followJob("cutout", job, { clipId: "img" }));
    expect(overlay()).not.toBeNull();
    expect(document.querySelector('[role="status"]')).toHaveTextContent(ptMessages.mediaGeneration.generating.cutout);
    act(() => editor.view.setState({ playheadMs: 3500 }));
    expect(overlay()).toBeNull();
  });

  it("marks the clip bar in the timeline while the job runs and clears it when done", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    let id = "";
    act(() => void (id = editor.commands.followJob("cutout", job, { clipId: "img" })));
    expect(bar()).toHaveAttribute("data-job-bar", "running");
    expect(bar()!.querySelector("[data-ai-progress]")).toHaveAttribute("data-ai-progress", "running");
    act(() => editor.commands.jobFinished(id));
    expect(bar()).toBeNull();
  });

  it("shows a brief failed state on the clip bar and then clears it", { timeout: 15_000 }, () => {
    vi.useFakeTimers();
    const { editor } = renderInEditor(doc(), <Timeline />);
    let id = "";
    act(() => void (id = editor.commands.followJob("cutout", job, { clipId: "img" })));
    act(() => editor.commands.jobFailed(id, { code: "provider_busy", message: "" }));
    expect(bar()).toHaveAttribute("data-job-bar", "failed");
    act(() => vi.advanceTimersByTime(OVERLAY_FAILURE_MS));
    expect(bar()).toBeNull();
  });
});

describe("the AI progress surface in the video panels", () => {
  const generation: MediaGenerationJob = { ...job, id: "srv-2", kind: "image", aspect: "square", sourceMediaId: undefined };

  it("holds a square placeholder in the element generator while the element is made, and clears it when done", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <VideoElementGenerator categoryId="elements" />);
    let id = "";
    act(() => void (id = editor.commands.followJob("image", generation, { atMs: 0, thenCutout: true })));
    const surface = document.querySelector<HTMLElement>("[data-ai-progress]")!;
    expect(surface).toHaveAttribute("data-ai-progress", "running");
    expect(surface.className).toContain("aspect-square");
    expect(surface.querySelector('[role="status"]')).toHaveTextContent(ptMessages.mediaGeneration.generating.image);
    act(() => editor.commands.jobFinished(id));
    expect(document.querySelector("[data-ai-progress]")).toBeNull();
  });

  it("sweeps a status strip in the processing panel instead of a plain spinner", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <ProcessPanel />);
    act(() => void editor.commands.followJob("cutout", job, { clipId: "img" }));
    const surface = document.querySelector<HTMLElement>("[data-ai-progress]")!;
    expect(surface.className).toContain("h-9");
    expect(surface.querySelector('[role="status"]')).toHaveTextContent(ptMessages.mediaGeneration.generating.cutout);
  });

  it("marks the library item a job is working on in the media panel, and clears it with the result", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <MediaPanel />);
    const media = { id: "foto-1", type: "image", url: "https://cdn/foto-1.png", description: "foto" } as never;
    act(() => editor.assets.store.setState({ library: { status: "ready", medias: [media] } }));
    const tile = () => document.querySelector<HTMLElement>('[title="foto"]')!;
    expect(tile().querySelector("[data-ai-progress]")).toBeNull();
    let id = "";
    act(() => void (id = editor.commands.followJob("cutout", job, { clipId: "img" })));
    const surface = tile().querySelector<HTMLElement>("[data-ai-progress]")!;
    expect(surface).toHaveAttribute("data-ai-progress", "running");
    expect(surface.className).toContain("pointer-events-none");
    expect(surface.querySelector('[role="status"]')).toHaveTextContent(ptMessages.mediaGeneration.generating.cutout);
    act(() => editor.commands.jobFinished(id));
    expect(tile().querySelector("[data-ai-progress]")).toBeNull();
  });
});
