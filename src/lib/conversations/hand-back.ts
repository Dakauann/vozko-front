import { isAutomationAssignee } from "@/lib/conversations/assignee";
import type { AIHandler } from "@/lib/conversations/types";

/**
 * The automation a conversation held by a person, or by nobody, can be handed
 * (back) to. It is the one the channel runs now (the inbox's `ai_handler`),
 * because replies follow the channel's configuration, not whoever handed the
 * conversation off.
 */
export interface HandBackTarget {
  kind: "ai" | "workflow";
  name: string;
}

export function handBackTarget(entry: {
  assigned_user_id?: string | null;
  ai_handler?: AIHandler | null;
}): HandBackTarget | null {
  if (isAutomationAssignee(entry.assigned_user_id)) return null;
  const handler = entry.ai_handler;
  if (handler?.kind === "agent") {
    return { kind: "ai", name: handler.agent_name?.trim() || "IA" };
  }
  if (handler?.kind === "workflow") {
    return { kind: "workflow", name: handler.workflow_name?.trim() || "Fluxo" };
  }
  return null;
}

/**
 * Whether the person who handed a conversation back stops seeing it. The
 * server cannot push that removal to someone who just lost access, so their
 * own client drops the row.
 */
export function leavesViewerAfterHandBack(ownerAfter: string, canViewOthers: boolean): boolean {
  return isAutomationAssignee(ownerAfter) && !canViewOthers;
}
