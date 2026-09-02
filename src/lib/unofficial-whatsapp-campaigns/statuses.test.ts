import { describe, expect, it } from "vitest";

import {
  UNOFFICIAL_DISPATCHED_STATUSES,
  UNOFFICIAL_SEND_STATUSES,
  canPause,
  canStart,
  canStop,
} from "./statuses";

/**
 * The status vocabulary and the lifecycle rules, pinned against the Go domain.
 *
 * Both are duplicated in the browser because the screen has to disable the
 * wrong buttons before a request is made. Duplicated rules drift, so the ones
 * that matter are asserted here.
 */
describe("send statuses", () => {
  it("includes the skip bucket this channel alone can produce", () => {
    const values = UNOFFICIAL_SEND_STATUSES.map((s) => s.value);
    expect(values).toContain("SKIPPED_NOT_ON_WHATSAPP");
  });

  it("never counts a skip or a failure as dispatched", () => {
    // Mirrors StatusSet().Dispatched(), which removes the never-sent buckets.
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
    // Re-running a finished campaign after a reset is normal; refusing it would
    // make reset a dead end.
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
