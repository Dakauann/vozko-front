import { describe, expect, it } from "vitest";

import { imageJobOutcome, isTerminalImageJob, nextPollDelay } from "./polling";
import type { ImageGenerationJob } from "./types";

function job(overrides: Partial<ImageGenerationJob>): ImageGenerationJob {
  return {
    id: "job-1",
    status: "queued",
    prompt: "a red bike",
    aspect: "square",
    referenceMediaIds: [],
    createdAt: "2026-10-02T10:00:00Z",
    updatedAt: "2026-10-02T10:00:00Z",
    ...overrides,
  };
}

describe("isTerminalImageJob", () => {
  it("treats only done and failed as terminal", () => {
    expect(isTerminalImageJob("done")).toBe(true);
    expect(isTerminalImageJob("failed")).toBe(true);
    expect(isTerminalImageJob("queued")).toBe(false);
    expect(isTerminalImageJob("running")).toBe(false);
    expect(isTerminalImageJob("cancelled")).toBe(false);
    expect(isTerminalImageJob("")).toBe(false);
  });
});

describe("nextPollDelay", () => {
  it("starts at 1.5 seconds", () => {
    expect(nextPollDelay(null)).toBe(1_500);
  });

  it("grows by half each time until the 5 second cap", () => {
    const delays: number[] = [];
    let delay: number | null = null;
    for (let i = 0; i < 6; i += 1) {
      delay = nextPollDelay(delay);
      delays.push(delay);
    }
    expect(delays).toEqual([1_500, 2_250, 3_375, 5_000, 5_000, 5_000]);
  });
});

describe("imageJobOutcome", () => {
  it("returns the media of a finished job", () => {
    expect(imageJobOutcome(job({ status: "done", mediaId: "m1", mediaUrl: "https://cdn/m1.png" }))).toEqual({
      kind: "done",
      mediaId: "m1",
      mediaUrl: "https://cdn/m1.png",
    });
  });

  it("fails a finished job without a media id", () => {
    expect(imageJobOutcome(job({ status: "done", mediaUrl: "https://cdn/m1.png" }))).toEqual({ kind: "failed", code: "missing_media" });
  });

  it("fails a finished job without a media url", () => {
    expect(imageJobOutcome(job({ status: "done", mediaId: "m1" }))).toEqual({ kind: "failed", code: "missing_media" });
  });

  it("carries the failure code of a failed job", () => {
    expect(imageJobOutcome(job({ status: "failed", failureCode: "storage_failed" }))).toEqual({ kind: "failed", code: "storage_failed" });
  });

  it("marks a failed job without a code as an unknown failure", () => {
    expect(imageJobOutcome(job({ status: "failed" }))).toEqual({ kind: "failed", code: "unknown" });
  });

  it("keeps queued, running and unrecognised jobs pending", () => {
    expect(imageJobOutcome(job({ status: "queued" }))).toEqual({ kind: "pending" });
    expect(imageJobOutcome(job({ status: "running" }))).toEqual({ kind: "pending" });
    expect(imageJobOutcome(job({ status: "archived" as ImageGenerationJob["status"], mediaId: "m1", mediaUrl: "u" }))).toEqual({
      kind: "pending",
    });
  });
});
