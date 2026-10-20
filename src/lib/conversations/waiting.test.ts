import { describe, expect, it } from "vitest";

import * as waiting from "./waiting";
import { WAITING_ALERT_MINUTES, waitingAlert } from "./waiting";

describe("the waiting alert", () => {
  const since = "2026-10-18T12:00:00Z";

  it("starts once the wait reaches the threshold", () => {
    const threshold = Date.parse(since) + WAITING_ALERT_MINUTES * 60_000;
    expect(waitingAlert(since, threshold - 1)).toBe(false);
    expect(waitingAlert(since, threshold)).toBe(true);
  });

  it("uses fifteen minutes", () => {
    expect(WAITING_ALERT_MINUTES).toBe(15);
  });

  it("never raises the alert for an unreadable time", () => {
    expect(waitingAlert("not a time", Date.now())).toBe(false);
  });
});

describe("who decides that a customer is waiting", () => {
  it("is the server alone, so the client keeps no copy of the rule", () => {
    expect(Object.keys(waiting).sort()).toEqual(["WAITING_ALERT_MINUTES", "waitingAlert"]);
  });
});
