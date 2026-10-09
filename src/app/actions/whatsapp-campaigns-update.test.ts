import { beforeEach, describe, expect, it, vi } from "vitest";

const apiClient = vi.fn();

vi.mock("@/lib/api/browser-client", () => ({
    apiClient: (...args: unknown[]) => apiClient(...args),
    getApiBaseUrl: () => "https://api.test",
    scopeHeaders: () => ({}),
    fetchWithRefresh: vi.fn(),
}));

import { updateWhatsAppCampaignAction } from "@/app/actions/whatsapp-campaigns";
import type { WhatsAppCampaignPayload } from "@/lib/whatsapp-campaigns/types";

const payload: WhatsAppCampaignPayload = {
    name: "Disparo",
    templateId: "tpl-1",
    businessPhoneId: "phone-1",
    enableAgentResponses: false,
    preferAudio: false,
    showTemplateInCrm: false,
    enableAnalysis: false,
    enableAutoStaging: false,
    enableAutoMemory: false,
    phoneNumbers: [],
};

beforeEach(() => {
    apiClient.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("updateWhatsAppCampaignAction", () => {
    it("hands the refusal code to the form so it can explain a locked selection send", async () => {
        apiClient.mockResolvedValue({
            error: { message: "campaign: a send prepared from a lead selection cannot be changed", code: "send_selection_locked" },
        });

        const result = await updateWhatsAppCampaignAction("camp-1", payload);

        expect(result).toEqual({
            campaign: null,
            error: "campaign: a send prepared from a lead selection cannot be changed",
            errorCode: "send_selection_locked",
        });
    });

    it("answers no code when the update goes through", async () => {
        apiClient.mockResolvedValue({ data: { success: true, data: { id: "camp-1", name: "Disparo" } } });

        const result = await updateWhatsAppCampaignAction("camp-1", payload);

        expect(result.error).toBeNull();
        expect(result.errorCode).toBeUndefined();
        expect(result.campaign?.id).toBe("camp-1");
    });
});
