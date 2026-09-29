import { beforeEach, describe, expect, it, vi } from "vitest";

import { adminLiveDecisionSummaryAction } from "@/app/actions/live-decisions";
import { failureRate } from "@/lib/live-decisions/types";

const { apiClient } = vi.hoisted(() => ({ apiClient: vi.fn() }));
vi.mock("@/lib/api/browser-client", () => ({ apiClient }));

describe("live decision summary action", () => {
    beforeEach(() => apiClient.mockReset());

    it("asks the admin summary for the chosen period", async () => {
        apiClient.mockResolvedValue({ data: [] });
        await adminLiveDecisionSummaryAction(30);
        expect(apiClient).toHaveBeenCalledWith("/admin/live-decisions/summary?days=30", { method: "GET" });
    });

    it("keeps the error of a refused read", async () => {
        apiClient.mockResolvedValue({ error: { message: "forbidden", status: 403 } });
        const result = await adminLiveDecisionSummaryAction(7);
        expect(result.summaries).toEqual([]);
        expect(result.error?.status).toBe(403);
    });
});

describe("live decision rules", () => {
    it("measures failures against every attempt", () => {
        const base = { workspaceId: "w", workspaceName: "W", costMicros: 0, avgLatencyMs: 0, effects: {} };
        expect(failureRate({ ...base, decisions: 9, failures: 1 })).toBeCloseTo(0.1);
        expect(failureRate({ ...base, decisions: 0, failures: 0 })).toBe(0);
    });
});
