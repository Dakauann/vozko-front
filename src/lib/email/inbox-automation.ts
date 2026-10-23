import type { EmailInboxSettings } from "@/lib/email/types";

export const EMAIL_INBOX_ERROR_CODES = ["inbox_not_found", "reference_not_in_workspace", "invalid_body"] as const;

export type EmailInboxChange = Partial<EmailInboxSettings>;

export function inboxSettingsOf(inbox: EmailInboxSettings): EmailInboxSettings {
  return {
    departmentId: inbox.departmentId ?? null,
    pipelineId: inbox.pipelineId ?? null,
    agentId: inbox.agentId ?? null,
    workflowId: inbox.workflowId ?? null,
    enableAgentResponses: inbox.enableAgentResponses,
    enableWorkflow: inbox.enableWorkflow,
    enableAnalysis: inbox.enableAnalysis,
    enableAutoStaging: inbox.enableAutoStaging,
    enableAutoMemory: inbox.enableAutoMemory,
  };
}

export function withInboxChange(settings: EmailInboxSettings, change: EmailInboxChange): EmailInboxSettings {
  const next = { ...settings };
  for (const key of Object.keys(next) as (keyof EmailInboxSettings)[]) {
    if (change[key] !== undefined) Object.assign(next, { [key]: change[key] });
  }
  return next;
}
