import type { CarrierChannelAutomation, CarrierInboxSettings } from "@/lib/carrier-messaging/types";

export interface AutomationAccount {
  id: string;
  agentId: string | null;
  workflowId: string | null;
  pipelineId: string | null;
  enableAgentResponses: boolean;
  enableWorkflow: boolean;
  enableAnalysis: boolean;
  enableAutoStaging: boolean;
  enableAutoMemory: boolean;
}

export interface AutomationChange {
  agentId?: string | null;
  workflowId?: string | null;
  pipelineId?: string | null;
  enableAgentResponses?: boolean;
  enableWorkflow?: boolean;
  enableAnalysis?: boolean;
  enableAutoStaging?: boolean;
  enableAutoMemory?: boolean;
}

export function inboxSettingsOf(owner: CarrierInboxSettings): CarrierInboxSettings {
  return { department_id: owner.department_id, pipeline_id: owner.pipeline_id, automation: owner.automation };
}

export function automationAccount(id: string, settings: CarrierInboxSettings): AutomationAccount {
  const automation = settings.automation;
  return {
    id,
    agentId: automation.agent_id,
    workflowId: automation.workflow_id,
    pipelineId: settings.pipeline_id,
    enableAgentResponses: automation.enable_agent_responses,
    enableWorkflow: automation.enable_workflow,
    enableAnalysis: automation.enable_analysis,
    enableAutoStaging: automation.enable_auto_staging,
    enableAutoMemory: automation.enable_auto_memory,
  };
}

function withAutomation(automation: CarrierChannelAutomation, change: AutomationChange): CarrierChannelAutomation {
  const next = { ...automation };
  if (change.agentId !== undefined) next.agent_id = change.agentId;
  if (change.workflowId !== undefined) next.workflow_id = change.workflowId;
  if (change.enableAgentResponses !== undefined) next.enable_agent_responses = change.enableAgentResponses;
  if (change.enableWorkflow !== undefined) next.enable_workflow = change.enableWorkflow;
  if (change.enableAnalysis !== undefined) next.enable_analysis = change.enableAnalysis;
  if (change.enableAutoStaging !== undefined) next.enable_auto_staging = change.enableAutoStaging;
  if (change.enableAutoMemory !== undefined) next.enable_auto_memory = change.enableAutoMemory;
  return next;
}

export function withInboxChange(settings: CarrierInboxSettings, change: AutomationChange): CarrierInboxSettings {
  return {
    department_id: settings.department_id,
    pipeline_id: change.pipelineId !== undefined ? change.pipelineId || null : settings.pipeline_id,
    automation: withAutomation(settings.automation, change),
  };
}
