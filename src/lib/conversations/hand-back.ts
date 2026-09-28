import { isAutomationAssignee } from "@/lib/conversations/assignee";
import type { AIHandler } from "@/lib/conversations/types";

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

export function leavesViewerAfterHandBack(ownerAfter: string, canViewOthers: boolean): boolean {
  return isAutomationAssignee(ownerAfter) && !canViewOthers;
}
