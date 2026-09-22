import { describe, expect, it } from "vitest";

import {
  seededOutcomeCounts,
  UNOFFICIAL_DISPATCHED_STATUSES,
  UNOFFICIAL_SEND_STATUSES,
  canPause,
  canStart,
  canStop,
} from "./statuses";

describe("send statuses", () => {
  it("includes the skip bucket this channel alone can produce", () => {
    const values = UNOFFICIAL_SEND_STATUSES.map((s) => s.value);
    expect(values).toContain("SKIPPED_NOT_ON_WHATSAPP");
  });

  it("never counts a skip or a failure as dispatched", () => {
    expect(UNOFFICIAL_DISPATCHED_STATUSES).not.toContain("SKIPPED_NOT_ON_WHATSAPP");
    expect(UNOFFICIAL_DISPATCHED_STATUSES).not.toContain("FAILED");
    expect(UNOFFICIAL_DISPATCHED_STATUSES).not.toContain("NOT_ELIGIBLE_POSSIBLE_SPAM");
    expect(UNOFFICIAL_DISPATCHED_STATUSES).not.toContain("PENDING");
  });

  it("labels every status", () => {
    for (const status of UNOFFICIAL_SEND_STATUSES) {
      expect(status.labelKey).toMatch(/^status\./);
    }
  });
});

describe("lifecycle guards", () => {
  it("mirrors ResolveTransition", () => {
    expect(canStart("STOPPED")).toBe(true);
    expect(canStart("PAUSED")).toBe(true);
    expect(canStart("COMPLETED")).toBe(true);
    expect(canStart("RUNNING")).toBe(false);

    expect(canPause("RUNNING")).toBe(true);
    expect(canPause("STOPPED")).toBe(false);
    expect(canPause("COMPLETED")).toBe(false);

    expect(canStop("RUNNING")).toBe(true);
    expect(canStop("PAUSED")).toBe(true);
    expect(canStop("COMPLETED")).toBe(true);
    expect(canStop("STOPPED")).toBe(false);
  });
});

describe("seededOutcomeCounts", () => {
  it("divides the list the way the server does", () => {
    expect(seededOutcomeCounts(100, 30, 10)).toEqual({
      sent: 30,
      failed: 10,
      pending: 60,
    });
  });

  it("floors rather than rounds, so the preview never promises a row that does not exist", () => {
    expect(seededOutcomeCounts(7, 50, 20)).toEqual({
      sent: 3,
      failed: 1,
      pending: 3,
    });
  });

  it("treats an empty or nonsense percentage as nothing settled", () => {
    expect(seededOutcomeCounts(10, Number.NaN, -5)).toEqual({
      sent: 0,
      failed: 0,
      pending: 10,
    });
  });

  it("leaves nothing pending when the shares add up to 100", () => {
    expect(seededOutcomeCounts(3, 40, 60)).toEqual({
      sent: 1,
      failed: 2,
      pending: 0,
    });

    for (let total = 1; total <= 200; total++) {
      expect(seededOutcomeCounts(total, 40, 60).pending).toBe(0);
      expect(seededOutcomeCounts(total, 33, 67).pending).toBe(0);
    }
  });

  it("never settles more entries than the list holds", () => {
    for (let total = 1; total <= 60; total++) {
      for (let sent = 0; sent <= 100; sent += 7) {
        for (let failed = 0; failed <= 100; failed += 11) {
          const counts = seededOutcomeCounts(total, sent, failed);
          expect(counts.failed).toBeGreaterThanOrEqual(0);
          expect(counts.sent + counts.failed + counts.pending).toBe(total);
        }
      }
    }
  });
});
