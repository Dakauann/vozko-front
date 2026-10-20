import type { ConversationMessage } from "@/lib/conversations/types";

import { payloadRecord, simConversationMessage } from "./sim-message";
import type { WorkflowRunLog } from "./types";

export interface SimulatedChange {
  kind: string;
  description: string;
}

export interface SandboxEffects {
  wouldDo: SimulatedChange[];
  sentMessages: ConversationMessage[];
  notice?: string;
}

function listOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function changeOf(value: unknown): SimulatedChange[] {
  const fields = payloadRecord(value);
  const description = typeof fields.description === "string" ? fields.description.trim() : "";
  if (!description) return [];
  return [{ kind: typeof fields.kind === "string" ? fields.kind : "", description }];
}

export function sandboxEffectsOf(step: WorkflowRunLog): SandboxEffects {
  const output = payloadRecord(step.output);
  const notice = step.notice?.trim();
  return {
    wouldDo: step.simulated ? listOf(output.would_do).flatMap(changeOf) : [],
    sentMessages: listOf(output.sent_messages).flatMap((wire) => simConversationMessage(wire) ?? []),
    ...(notice ? { notice } : {}),
  };
}
