"use client";

import type { ReactNode } from "react";
import { AGENT_CALL_TRIGGER, REPLY_TO_AGENT_NODE } from "@/lib/workflows/agent-call";
import type { WorkflowNodeType } from "@/lib/workflows/types";

import { AgentCallTriggerPreview, ReplyToAgentPreview } from "./agent-call-previews";

import { ConsentPreview } from "./consent-preview";
import { FormTriggerPreview, SendFormPreview } from "./form-previews";
import { UpdateLeadPreview } from "./update-lead-preview";

export function renderActionContentPreview(
  nodeType: WorkflowNodeType,
  config: Record<string, unknown>,
): ReactNode | undefined {
  switch (nodeType) {
    case "action_update_lead":
      return <UpdateLeadPreview config={config} />;
    case "action_consent":
      return <ConsentPreview config={config} />;
    case "action_send_form":
      return <SendFormPreview config={config} />;
    case "trigger_form_submitted":
      return <FormTriggerPreview config={config} />;
    case AGENT_CALL_TRIGGER:
      return <AgentCallTriggerPreview config={config} />;
    case REPLY_TO_AGENT_NODE:
      return <ReplyToAgentPreview config={config} />;
    default:
      return undefined;
  }
}
