"use client";

import { FlowArrow, Robot, User } from "@/components/icons";
import { assigneeKind } from "@/lib/conversations/assignee";

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
