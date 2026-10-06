import { describe, expect, it } from "vitest";

import { mediaJobOutcome, isTerminalMediaJob, nextPollDelay } from "./polling";
import type { MediaGenerationJob } from "./types";

function job(overrides: Partial<MediaGenerationJob>): MediaGenerationJob {
  return {
    id: "job-1",
    kind: "image",
    status: "queued",
    prompt: "a red bike",
    aspect: "square",
    referenceMediaIds: [],
    createdAt: "2026-10-02T10:00:00Z",
    updatedAt: "2026-10-02T10:00:00Z",
    ...overrides,
  };
}

describe("isTerminalMediaJob", () => {
  it("treats only done and failed as terminal", () => {
    expect(isTerminalMediaJob("done")).toBe(true);
    expect(isTerminalMediaJob("failed")).toBe(true);
    expect(isTerminalMediaJob("queued")).toBe(false);
    expect(isTerminalMediaJob("running")).toBe(false);
    expect(isTerminalMediaJob("settling")).toBe(false);
    expect(isTerminalMediaJob("cancelled")).toBe(false);
    expect(isTerminalMediaJob("")).toBe(false);
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

describe("mediaJobOutcome", () => {
  it("returns the media of a finished job", () => {
    expect(mediaJobOutcome(job({ status: "done", mediaId: "m1", mediaUrl: "https://cdn/m1.png" }))).toEqual({
      kind: "done",
      mediaId: "m1",
      mediaUrl: "https://cdn/m1.png",
    });
  });

  it("fails a finished job without a media id", () => {
    expect(mediaJobOutcome(job({ status: "done", mediaUrl: "https://cdn/m1.png" }))).toEqual({ kind: "failed", code: "missing_media" });
  });

  it("fails a finished job without a media url", () => {
    expect(mediaJobOutcome(job({ status: "done", mediaId: "m1" }))).toEqual({ kind: "failed", code: "missing_media" });
  });

  it("carries the failure code of a failed job", () => {
    expect(mediaJobOutcome(job({ status: "failed", failureCode: "storage_failed" }))).toEqual({ kind: "failed", code: "storage_failed" });
  });

  it("marks a failed job without a code as an unknown failure", () => {
    expect(mediaJobOutcome(job({ status: "failed" }))).toEqual({ kind: "failed", code: "unknown" });
  });

  it("keeps queued, running and unrecognised jobs pending", () => {
    expect(mediaJobOutcome(job({ status: "queued" }))).toEqual({ kind: "pending", settling: false });
    expect(mediaJobOutcome(job({ status: "running" }))).toEqual({ kind: "pending", settling: false });
    expect(mediaJobOutcome(job({ status: "archived" as MediaGenerationJob["status"], mediaId: "m1", mediaUrl: "u" }))).toEqual({
      kind: "pending",
      settling: false,
    });
  });

  it("keeps a settling job pending and never hands out its media", () => {
    expect(mediaJobOutcome(job({ status: "settling", mediaId: "m1", mediaUrl: "https://cdn/m1.m4a" }))).toEqual({
      kind: "pending",
      settling: true,
    });
  });
});
