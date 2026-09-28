import { describe, expect, it } from "vitest";

import {
    capabilityGate,
    displayStatus,
    facebookPageConfig,
    pageNotices,
    withPageConfig,
} from "@/lib/facebook/page";
import type { FacebookPage } from "@/lib/facebook/types";

function page(overrides: Partial<FacebookPage> = {}): FacebookPage {
    return {
        id: "page-1",
        workspaceId: "ws-1",
        departmentId: null,
        fbPageId: "123",
        name: "Loja",
        followersCount: 10,
        status: "CONNECTED",
        tasks: ["MANAGE"],
        grantedScopes: [],
        capabilities: { messaging: true, readPosts: true, publish: true, moderate: true, comment: true, subscribe: true },
        needsReconnect: false,
        webhookSubscribedAt: "2026-09-25T12:00:00Z",
        subscribedFields: ["messages"],
        routing: { isDefaultApp: true },
        policy: {},
        humanAgentAvailable: false,
        agentId: "agent-1",
        workflowId: null,
        pipelineId: "pipe-1",
        enableAgentResponses: true,
        enableWorkflow: false,
        enableAnalysis: true,
        enableAutoStaging: false,
        enableAutoMemory: true,
        automationDisclosure: "Assistente automático",
        createdAt: "2026-09-25T12:00:00Z",
        updatedAt: "2026-09-25T12:00:00Z",
        ...overrides,
    };
}

describe("facebookPageConfig", () => {
    it("carries every field the full-replace update needs", () => {
        expect(facebookPageConfig(page())).toEqual({
            departmentId: null,
            agentId: "agent-1",
            workflowId: null,
            pipelineId: "pipe-1",
            enableAgentResponses: true,
            enableWorkflow: false,
            enableAnalysis: true,
            enableAutoStaging: false,
            enableAutoMemory: true,
            automationDisclosure: "Assistente automático",
        });
    });

    it("merges a partial change without dropping the rest", () => {
        const next = withPageConfig(page(), { enableAgentResponses: false });
        expect(next.enableAgentResponses).toBe(false);
        expect(next.agentId).toBe("agent-1");
        expect(next.enableAnalysis).toBe(true);
        expect(next.automationDisclosure).toBe("Assistente automático");
    });
});

describe("displayStatus", () => {
    it("keeps the stored status when routing is fine or unknown", () => {
        expect(displayStatus(page())).toBe("CONNECTED");
        expect(displayStatus(page({ routing: { isDefaultApp: null } }))).toBe("CONNECTED");
    });

    it("reports routing off only when Vozko is known not to be the default app", () => {
        expect(displayStatus(page({ routing: { isDefaultApp: false } }))).toBe("ROUTING_OFF");
    });

    it("never hides a broken status behind the routing state", () => {
        expect(displayStatus(page({ status: "TOKEN_REVOKED", routing: { isDefaultApp: false } }))).toBe("TOKEN_REVOKED");
    });
});

describe("pageNotices", () => {
    it("is empty for a healthy page that is the default app", () => {
        expect(pageNotices(page())).toEqual([]);
    });

    it("asks to reconnect when the backend says so", () => {
        expect(pageNotices(page({ needsReconnect: true, status: "TOKEN_REVOKED" }))).toContain("reconnect");
    });

    it("flags a restricted page and a policy block", () => {
        expect(pageNotices(page({ status: "RESTRICTED" }))).toContain("restricted");
        expect(pageNotices(page({ policy: { action: "block", reason: "spam" } }))).toContain("restricted");
    });

    it("flags a missing webhook subscription on a connected page", () => {
        expect(pageNotices(page({ webhookSubscribedAt: undefined }))).toContain("webhook");
    });

    it("shows the routing notice whenever Vozko is not confirmed as the default app", () => {
        expect(pageNotices(page({ routing: { isDefaultApp: false } }))).toContain("routingOff");
        expect(pageNotices(page({ routing: { isDefaultApp: null } }))).toContain("routingUnknown");
    });

    it("flags a page that cannot receive messages", () => {
        expect(pageNotices(page({ capabilities: { ...page().capabilities, messaging: false } }))).toContain("messagingOff");
    });
});

describe("capabilityGate", () => {
    it("allows an action the page granted", () => {
        expect(capabilityGate(page(), "publish")).toEqual({ allowed: true });
    });

    it("refuses when the capability is missing and says why", () => {
        const p = page({ capabilities: { ...page().capabilities, moderate: false } });
        expect(capabilityGate(p, "moderate")).toEqual({ allowed: false, reason: "missing" });
    });

    it("refuses everything while the page needs reconnecting", () => {
        expect(capabilityGate(page({ needsReconnect: true, status: "NEEDS_ROLE" }), "publish")).toEqual({
            allowed: false,
            reason: "reconnect",
        });
    });

    it("refuses everything while the page is not connected", () => {
        expect(capabilityGate(page({ status: "RESTRICTED" }), "comment")).toEqual({ allowed: false, reason: "notConnected" });
        expect(capabilityGate(page({ status: "PENDING" }), "comment")).toEqual({ allowed: false, reason: "notConnected" });
    });
});
