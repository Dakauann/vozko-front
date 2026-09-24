"use client";

import { FlowArrow, Robot, User } from "@/components/icons";
import { assigneeKind } from "@/lib/conversations/assignee";

/**
 * The icon beside an owner's name: a person, an AI agent or a workflow. The
 * name alone ("Sofia") cannot tell an operator that nobody human has it yet.
 */
export function AssigneeGlyph({
  assignedUserId,
  className,
}: {
  assignedUserId?: string | null;
  className?: string;
}) {
  const kind = assigneeKind(assignedUserId);
  if (kind === "workflow") {
    return <FlowArrow weight="bold" className={className} data-assignee-kind="workflow" />;
  }
  if (kind === "ai") {
    return <Robot weight="bold" className={className} data-assignee-kind="ai" />;
  }
  return <User weight="bold" className={className} data-assignee-kind="human" />;
}
