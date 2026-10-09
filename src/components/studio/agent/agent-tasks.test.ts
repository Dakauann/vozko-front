import { describe, expect, it } from "vitest";

import { agentTasks as imageTasks } from "../image/jobs";
import { agentTasks as videoTasks } from "../video/jobs";
import type { StudioJob } from "../image/editor-state";
import type { VideoJob } from "../video/view-store";

const queued = { id: "g-1", kind: "music" as const, status: "running" as const, referenceMediaIds: [], createdAt: "", updatedAt: "" };

describe("Elo's queued work", () => {
  it("lists only the video jobs Elo started that are still running", () => {
    const jobs: VideoJob[] = [
      { id: "a", purpose: "music", target: { atMs: 0 }, created: queued, state: "running", settling: false, error: null, byAgent: true },
      { id: "b", purpose: "captions", target: { clipId: "c1" }, created: queued, state: "running", settling: true, error: null, byAgent: true },
      { id: "c", purpose: "voice", target: { atMs: 0 }, created: queued, state: "done", settling: false, error: null, byAgent: true },
      { id: "d", purpose: "image", target: { atMs: 0 }, created: queued, state: "running", settling: false, error: null, byAgent: false },
    ];
    expect(videoTasks(jobs)).toEqual([
      { id: "a", action: "job_music", settling: false },
      { id: "b", action: "job_captions", settling: true },
    ]);
  });

  it("lists only the image jobs Elo started that have not failed", () => {
    const jobs: StudioJob[] = [
      { id: "a", purpose: "generate", layerId: null, created: queued, settling: false, error: null, byAgent: true },
      { id: "b", purpose: "cutout", layerId: "l1", created: queued, settling: false, error: "timed_out", byAgent: true },
      { id: "c", purpose: "edit", layerId: null, created: null, settling: false, error: null, byAgent: false },
    ];
    expect(imageTasks(jobs)).toEqual([{ id: "a", action: "job_image", settling: false }]);
  });
});
