import { describe, expect, it } from "vitest";

import { campaignLiveKey, campaignLivePath, liveRefetchInterval } from "@/lib/campaigns/live";

describe("campaign live", () => {
  it("follows the cadence the backend asks for and stops when it says there is nothing to follow", () => {
    expect(liveRefetchInterval({ refreshAfterSeconds: 5 })).toBe(5000);
    expect(liveRefetchInterval({ refreshAfterSeconds: 0 })).toBe(false);
    expect(liveRefetchInterval(undefined)).toBe(false);
  });

  it("reads each channel from its own campaign routes", () => {
    expect(campaignLivePath("whatsapp", "camp-1", "progress")).toBe("/whatsapp/campaigns/camp-1/progress");
    expect(campaignLivePath("unofficial_whatsapp", "camp-1", "timeline", "hour")).toBe("/unofficial-whatsapp/campaigns/camp-1/timeline?bucket=hour");
  });

  it("caches per channel, workspace, campaign, section and bucket", () => {
    expect(campaignLiveKey("whatsapp", "ws-1", "camp-1", "timeline")).toEqual(["campaign-live", "whatsapp", "ws-1", "camp-1", "timeline", "auto"]);
    expect(campaignLiveKey("unofficial_whatsapp", "ws-1", "camp-1", "timeline", "minute")).not.toEqual(campaignLiveKey("whatsapp", "ws-1", "camp-1", "timeline", "minute"));
  });
});
