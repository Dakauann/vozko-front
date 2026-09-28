import { normalizeActorKind } from "@/lib/conversations/events";

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
