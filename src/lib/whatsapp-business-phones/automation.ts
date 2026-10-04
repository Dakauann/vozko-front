export interface NumberAutomation {
    id: string;
    agentId?: string | null;
    workflowId?: string | null;
    pipelineId?: string | null;
    enableAgentResponses: boolean;
    enableWorkflow: boolean;
    enableAnalysis: boolean;
    enableAutoStaging: boolean;
    enableAutoMemory: boolean;
}

export interface NumberAutomationConfig {
    agentId: string | null;
    workflowId: string | null;
    pipelineId: string | null;
    enableAgentResponses: boolean;
    enableWorkflow: boolean;
    enableAnalysis: boolean;
    enableAutoStaging: boolean;
    enableAutoMemory: boolean;
}

function numberAutomationConfig(automation: NumberAutomation): NumberAutomationConfig {
    return {
        agentId: automation.agentId ?? null,
        workflowId: automation.workflowId ?? null,
        pipelineId: automation.pipelineId ?? null,
        enableAgentResponses: automation.enableAgentResponses,
        enableWorkflow: automation.enableWorkflow,
        enableAnalysis: automation.enableAnalysis,
        enableAutoStaging: automation.enableAutoStaging,
        enableAutoMemory: automation.enableAutoMemory,
    };
}

export function withNumberAutomation(
    automation: NumberAutomation,
    patch: Partial<NumberAutomationConfig>,
): NumberAutomationConfig {
    return { ...numberAutomationConfig(automation), ...patch };
}
