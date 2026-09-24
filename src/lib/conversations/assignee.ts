import { normalizeActorKind } from "@/lib/conversations/events";

/**
 * Who holds a conversation. The backend sends a person's user id, `ai:<id>`
 * for an AI agent or `workflow:<id>` for a workflow; operators only see the
 * ones held by them or by nobody.
 */
export type AssigneeKind = "human" | "ai" | "workflow";

export function assigneeKind(assignedUserId?: string | null): AssigneeKind | null {
  const id = String(assignedUserId ?? "").trim();
  if (!id) return null;
  const kind = normalizeActorKind(undefined, id);
  return kind === "ai" || kind === "workflow" ? kind : "human";
}

export function isAutomationAssignee(assignedUserId?: string | null): boolean {
  const kind = assigneeKind(assignedUserId);
  return kind === "ai" || kind === "workflow";
}
