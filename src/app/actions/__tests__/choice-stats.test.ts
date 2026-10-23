import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiClient } = vi.hoisted(() => ({ apiClient: vi.fn() }));

vi.mock("@/lib/api/browser-client", () => ({ apiClient }));

import {
  getTemplateChoiceStatsAction,
  getUnofficialCampaignChoiceStatsAction,
  getWhatsAppCampaignChoiceStatsAction,
} from "@/app/actions/choice-stats";

const prompt = { sends: 3, clickedPrompts: 1, clickRate: 3333, freeText: { count: 0, rate: 0 }, options: [] };

describe("campaign and template choice stats", () => {
  beforeEach(() => apiClient.mockReset());

  it("reads the official campaign's lifetime clicks", async () => {
    apiClient.mockResolvedValue({ data: { from: null, to: null, timezone: "UTC", prompt } });
    const answer = await getWhatsAppCampaignChoiceStatsAction("c 1");
    expect(answer).toEqual({ status: "ready", stats: { from: null, to: null, timezone: "UTC", prompt: { ...prompt } } });
    expect(apiClient).toHaveBeenCalledWith("/whatsapp-campaigns/c%201/choice-stats", { method: "GET" });
  });

  it("reads the unofficial campaign's menu clicks", async () => {
    apiClient.mockResolvedValue({ data: { from: null, to: null, timezone: "UTC", prompt } });
    await getUnofficialCampaignChoiceStatsAction("u1");
    expect(apiClient).toHaveBeenCalledWith("/unofficial-whatsapp-campaigns/u1/choice-stats", { method: "GET" });
  });

  it("requires the tracked flag on template options", async () => {
    apiClient.mockResolvedValue({
      data: { from: null, to: null, timezone: "UTC", prompt: { ...prompt, options: [{ optionId: "template_url:0", shown: 1, clicks: 0, ctr: 0 }] } },
    });
    await expect(getTemplateChoiceStatsAction("t1")).resolves.toEqual({ status: "unreadable" });
    expect(apiClient).toHaveBeenCalledWith("/whatsapp-templates/t1/choice-stats", { method: "GET" });
  });

  it("passes the not found code on", async () => {
    apiClient.mockResolvedValue({ error: { message: "raw", status: 404, code: "campaign_not_found" } });
    await expect(getWhatsAppCampaignChoiceStatsAction("c1")).resolves.toMatchObject({ status: "failed", code: "campaign_not_found" });
  });
});
