import { describe, expect, it, vi } from "vitest";

import { emptyVideoDocument } from "@/lib/studio/document";
import { MAX_PARALLEL_GENERATIONS } from "@/lib/media-generation/limits";

import { keepRecentJobs } from "../editor-commands";
import { createVideoEditorRuntime } from "../runtime";
import type { VideoJob } from "../view-store";

const pending = new Promise<never>(() => undefined);

vi.mock("@/app/actions/media-generation", () => ({
  requestMediaGenerationAction: vi.fn(() => pending),
  getMediaGenerationAction: vi.fn(),
}));

function job(id: string, purpose: VideoJob["purpose"], state: VideoJob["state"]): VideoJob {
  return { id, purpose, target: {}, created: null, state, settling: false, error: null, byAgent: false };
}

describe("video editor job queue", () => {
  it("runs AI generations side by side and refuses one past the ceiling", () => {
    const runtime = createVideoEditorRuntime(emptyVideoDocument("story"));
    for (let i = 0; i < MAX_PARALLEL_GENERATIONS; i++) void runtime.commands.startJob("music", { kind: "music", model: "m", prompt: `p${i}` }, { atMs: 0 });
    expect(runtime.view.getState().jobs.filter((j) => j.state === "running")).toHaveLength(MAX_PARALLEL_GENERATIONS);
    void runtime.commands.startJob("voice", { kind: "voice", model: "m", prompt: "x" }, { atMs: 0 });
    expect(runtime.view.getState().jobs).toHaveLength(MAX_PARALLEL_GENERATIONS);
    expect(runtime.view.getState().notice).toEqual({ key: "tooManyJobs", tone: "error" });
  });

  it("keeps processing on its own lane", () => {
    const runtime = createVideoEditorRuntime(emptyVideoDocument("story"));
    for (let i = 0; i < MAX_PARALLEL_GENERATIONS; i++) void runtime.commands.startJob("image", { kind: "image", model: "m", prompt: `p${i}`, aspect: "story" }, { atMs: 0 });
    void runtime.commands.startJob("captions", { kind: "captions", sourceMediaId: "s" }, { clipId: "c" });
    expect(runtime.view.getState().jobs.some((j) => j.purpose === "captions")).toBe(true);
  });

  it("keeps every running job and only the last finished ones per kind", () => {
    const jobs = [job("a", "music", "done"), job("b", "music", "failed"), job("c", "music", "done"), job("d", "music", "done"), job("e", "music", "running"), job("f", "voice", "done")];
    expect(keepRecentJobs(jobs).map((j) => j.id)).toEqual(["b", "c", "d", "e", "f"]);
  });
});
