import { describe, expect, it } from "vitest";

import { withNumberAutomation, type NumberAutomation } from "@/lib/whatsapp-business-phones/automation";

const current: NumberAutomation = {
    id: "phone-1",
    agentId: "agent-1",
    pipelineId: "pipe-1",
    enableAgentResponses: true,
    enableWorkflow: false,
    enableAnalysis: true,
    enableAutoStaging: false,
    enableAutoMemory: true,
};

describe("withNumberAutomation", () => {
    it("sends the whole setting so a partial change never clears the rest", () => {
        expect(withNumberAutomation(current, { enableAutoStaging: true })).toEqual({
            agentId: "agent-1",
            workflowId: null,
            pipelineId: "pipe-1",
            enableAgentResponses: true,
            enableWorkflow: false,
            enableAnalysis: true,
            enableAutoStaging: true,
            enableAutoMemory: true,
        });
    });

    it("applies the panel's choice over the stored one", () => {
        const next = withNumberAutomation(current, { workflowId: "flow-1", enableWorkflow: true, enableAgentResponses: false });
        expect(next).toMatchObject({ agentId: "agent-1", workflowId: "flow-1", enableWorkflow: true, enableAgentResponses: false });
    });
});
