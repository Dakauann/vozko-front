import { describe, expect, it } from "vitest";

import { campaignListStatus } from "./statuses";

describe("campaignListStatus", () => {
  it("shows a stopped campaign that was never started as ready", () => {
    expect(campaignListStatus({ status: "STOPPED", readyToStart: true })).toBe("READY");
  });

  it("keeps every other status as the server sent it", () => {
    expect(campaignListStatus({ status: "STOPPED", readyToStart: false })).toBe("STOPPED");
    expect(campaignListStatus({ status: "STOPPED" })).toBe("STOPPED");
    expect(campaignListStatus({ status: "RUNNING", readyToStart: true })).toBe("RUNNING");
    expect(campaignListStatus({ status: "COMPLETED" })).toBe("COMPLETED");
  });
});
