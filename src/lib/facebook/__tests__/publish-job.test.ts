import { describe, expect, it } from "vitest";

import { isTerminalJob, jobOutcome } from "@/lib/facebook/publish-job";
import type { FacebookPublishJob } from "@/lib/facebook/types";

function job(overrides: Partial<FacebookPublishJob>): FacebookPublishJob {
    return {
        id: "job-1",
        kind: "photo",
        status: "QUEUED",
        error: null,
        createdAt: "2026-10-01T12:00:00Z",
        updatedAt: "2026-10-01T12:00:00Z",
        ...overrides,
    };
}

describe("isTerminalJob", () => {
    it("stops polling only on published, scheduled or failed", () => {
        expect(isTerminalJob("QUEUED")).toBe(false);
        expect(isTerminalJob("UPLOADING")).toBe(false);
        expect(isTerminalJob("PROCESSING")).toBe(false);
        expect(isTerminalJob("PUBLISHED")).toBe(true);
        expect(isTerminalJob("SCHEDULED")).toBe(true);
        expect(isTerminalJob("FAILED")).toBe(true);
    });
});

describe("jobOutcome", () => {
    it("is pending while the job runs", () => {
        expect(jobOutcome(job({ status: "PROCESSING" }))).toBe("pending");
    });

    it("tells published from scheduled", () => {
        expect(jobOutcome(job({ status: "PUBLISHED", fbPostId: "1_2" }))).toBe("published");
        expect(jobOutcome(job({ status: "SCHEDULED", fbPostId: "1_2" }))).toBe("scheduled");
    });

    it("keeps an ambiguous failure apart from a plain failure", () => {
        expect(jobOutcome(job({ status: "FAILED", error: { message: "x", ambiguous: true } }))).toBe("ambiguous");
        expect(jobOutcome(job({ status: "FAILED", error: { message: "x", ambiguous: false } }))).toBe("failed");
    });

    it("treats a failed job without an error body as a failure, never as success", () => {
        expect(jobOutcome(job({ status: "FAILED", error: null }))).toBe("failed");
    });
});
