import { describe, expect, it } from "vitest";

import { MAX_SCHEDULE_LEAD_MS, MAX_VIDEO_SCHEDULE_LEAD_MS, MIN_SCHEDULE_LEAD_MS, scheduleProblem } from "@/lib/facebook/schedule";

const NOW = new Date("2026-10-01T12:00:00Z");
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function at(offsetMs: number): Date {
    return new Date(NOW.getTime() + offsetMs);
}

describe("scheduleProblem", () => {
    it("mirrors the backend window: 10 minutes to 75 days, 180 days for videos", () => {
        expect(MIN_SCHEDULE_LEAD_MS).toBe(10 * MINUTE);
        expect(MAX_SCHEDULE_LEAD_MS).toBe(75 * DAY);
        expect(MAX_VIDEO_SCHEDULE_LEAD_MS).toBe(180 * DAY);
    });

    it("accepts the exact boundaries", () => {
        expect(scheduleProblem("photo", at(10 * MINUTE), NOW)).toBeNull();
        expect(scheduleProblem("photo", at(75 * DAY), NOW)).toBeNull();
        expect(scheduleProblem("video", at(180 * DAY), NOW)).toBeNull();
    });

    it("refuses a time less than 10 minutes ahead", () => {
        expect(scheduleProblem("text", at(10 * MINUTE - 1000), NOW)).toBe("tooSoon");
        expect(scheduleProblem("text", at(-MINUTE), NOW)).toBe("tooSoon");
    });

    it("refuses a time beyond the window for the kind", () => {
        expect(scheduleProblem("album", at(75 * DAY + 1000), NOW)).toBe("tooFar");
        expect(scheduleProblem("video", at(75 * DAY + 1000), NOW)).toBeNull();
        expect(scheduleProblem("video", at(180 * DAY + 1000), NOW)).toBe("tooFar");
    });

    it("never schedules a story", () => {
        expect(scheduleProblem("story", at(DAY), NOW)).toBe("notSchedulable");
    });

    it("refuses an unreadable date", () => {
        expect(scheduleProblem("text", new Date("nope"), NOW)).toBe("invalid");
    });
});
