import { describe, expect, it } from "vitest";

import type { NumberSeat } from "@/lib/unofficial-whatsapp-groups/types";

import { campaignLaunchBlock } from "./campaign-model";

function seat(instanceId: string, patch: Partial<NumberSeat> = {}): NumberSeat {
  return { instanceId, label: instanceId, connected: true, admin: false, canPost: true, ...patch };
}

describe("campaignLaunchBlock", () => {
  it("needs at least one group", () => {
    expect(campaignLaunchBlock([])).toBe("noGroups");
  });

  it("launches when any group has a number that posts, even if the groups share none", () => {
    expect(campaignLaunchBlock([{ numbers: [seat("a")] }, { numbers: [seat("b")] }])).toBeNull();
    expect(campaignLaunchBlock([{ numbers: [seat("a", { canPost: false })] }, { numbers: [seat("b")] }])).toBeNull();
  });

  it("says the posting numbers are offline when they only need to reconnect", () => {
    expect(campaignLaunchBlock([{ numbers: [seat("a", { canPost: false, connected: false })] }])).toBe("allOffline");
  });

  it("says no number posts when the numbers there may not post", () => {
    expect(campaignLaunchBlock([{ numbers: [seat("a", { canPost: false })] }, { numbers: [] }])).toBe("noShared");
  });
});
