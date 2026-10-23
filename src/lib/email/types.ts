export interface EmailInboxSettings {
  departmentId?: string | null;
  pipelineId?: string | null;
  agentId?: string | null;
  workflowId?: string | null;
  enableAgentResponses: boolean;
  enableWorkflow: boolean;
  enableAnalysis: boolean;
  enableAutoStaging: boolean;
  enableAutoMemory: boolean;
}

export interface EmailInbox extends EmailInboxSettings {
  id: string;
  workspaceId: string;
  name: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}
