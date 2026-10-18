import { beforeEach, describe, expect, it, vi } from "vitest";

const apiClient = vi.fn();

vi.mock("@/lib/api/browser-client", () => ({
    apiClient: (...args: unknown[]) => apiClient(...args),
    getApiBaseUrl: () => "https://api.test",
    scopeHeaders: () => ({}),
    fetchWithRefresh: vi.fn(),
}));

import { createWhatsAppCampaignAction } from "@/app/actions/whatsapp-campaigns";
import type { WhatsAppCampaignPayload } from "@/lib/whatsapp-campaigns/types";

const payload: WhatsAppCampaignPayload = {
    name: "Disparo",
    templateId: "tpl-1",
    businessPhoneId: "phone-1",
    enableAgentResponses: false,
    showTemplateInCrm: false,
    enableAnalysis: false,
    enableAutoStaging: false,
    enableAutoMemory: false,
    phoneNumbers: [],
    exitRiskAcknowledged: true,
};

beforeEach(() => {
    apiClient.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("createWhatsAppCampaignAction", () => {
    it("sends the exit risk acknowledgement the user gave", async () => {
        apiClient.mockResolvedValue({ data: { success: true, data: { id: "camp-1" } } });

        await createWhatsAppCampaignAction(payload);

        expect(JSON.parse(apiClient.mock.calls[0][1].body)).toMatchObject({ exitRiskAcknowledged: true });
    });

    it("hands the refusal code to the form so it can explain a missing acknowledgement", async () => {
        apiClient.mockResolvedValue({ error: { message: "exit risk not acknowledged", code: "exit_risk_not_acknowledged" } });

        const result = await createWhatsAppCampaignAction(payload);

        expect(result).toEqual({ campaign: null, error: "exit risk not acknowledged", errorCode: "exit_risk_not_acknowledged" });
    });
});
