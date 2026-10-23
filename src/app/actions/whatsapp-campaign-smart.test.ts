import { beforeEach, describe, expect, it, vi } from "vitest";

const apiClient = vi.fn();

vi.mock("@/lib/api/browser-client", () => ({
  apiClient: (...args: unknown[]) => apiClient(...args),
}));

import {
  getSmartCampaignAction,
  getSmartDefaultsAction,
  removeSmartCampaignAction,
  saveSmartCampaignAction,
} from "@/app/actions/whatsapp-campaign-smart";
import type { SmartPolicy } from "@/lib/whatsapp-campaigns/smart";

const policy: SmartPolicy = {
  preset: "standard", firstWaveSize: 200, minWaveSize: 50, maxWaveSize: 5000, growth: 2, shrink: 0.5,
  observeWaitMinutes: 120, maxObserveWaitMinutes: 300, maxWavesPerDay: 0, maxSlowWavesAtFloor: 3, minSample: 50,
  failureRateSlow: 0.08, failureRateStop: 0.15, engagementRateSlow: 0.03, onTemplateYellow: "pause", onPhoneYellow: "slow_down", onPhoneRed: "pause",
  sendHours: { timezone: "America/Sao_Paulo", days: { mon: [{ start: "08:00", end: "20:00" }] } },
};

beforeEach(() => apiClient.mockReset());

describe("smart campaign actions", () => {
  it("reads the view of a campaign", async () => {
    apiClient.mockResolvedValue({ data: { policy: null, editable: true, waves: [] } });

    const result = await getSmartCampaignAction("camp-1");

    expect(apiClient).toHaveBeenCalledWith("/whatsapp/campaigns/camp-1/smart", { method: "GET" });
    expect(result).toEqual({ view: { policy: null, editable: true, waves: [] }, error: null, errorCode: undefined });
  });

  it("saves a policy and hands back the refusal code", async () => {
    apiClient.mockResolvedValue({ error: { message: "smart campaign: invalid wave policy: send hours are required", code: "smart_campaign_invalid_policy" } });

    const result = await saveSmartCampaignAction("camp-1", policy);

    expect(apiClient).toHaveBeenCalledWith("/whatsapp/campaigns/camp-1/smart", { method: "PUT", body: JSON.stringify(policy) });
    expect(result).toEqual({ view: null, error: "smart campaign: invalid wave policy: send hours are required", errorCode: "smart_campaign_invalid_policy" });
  });

  it("turns wave sending off", async () => {
    apiClient.mockResolvedValue({ data: { policy: null } });

    await removeSmartCampaignAction("camp-1");

    expect(apiClient).toHaveBeenCalledWith("/whatsapp/campaigns/camp-1/smart", { method: "DELETE" });
  });
});

describe("getSmartDefaultsAction", () => {
  it("asks for the defaults of the chosen department", async () => {
    apiClient.mockResolvedValue({ data: { sendHours: null, presets: {} } });

    const result = await getSmartDefaultsAction("sales");

    expect(apiClient).toHaveBeenCalledWith("/whatsapp/campaign-waves/defaults?departmentId=sales", { method: "GET" });
    expect(result).toEqual({ defaults: { sendHours: null, presets: {} }, error: null });
  });

  it("asks for the workspace defaults without a department", async () => {
    apiClient.mockResolvedValue({ data: { sendHours: null, presets: {} } });

    await getSmartDefaultsAction();

    expect(apiClient).toHaveBeenCalledWith("/whatsapp/campaign-waves/defaults", { method: "GET" });
  });
});
