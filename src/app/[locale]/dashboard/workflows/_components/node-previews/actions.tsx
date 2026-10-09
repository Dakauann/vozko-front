"use client";

import type { ReactNode } from "react";
import type { WorkflowNodeType } from "@/lib/workflows/types";

import { UpdateLeadPreview } from "./update-lead-preview";

export function renderActionContentPreview(
  nodeType: WorkflowNodeType,
  config: Record<string, unknown>,
): ReactNode | undefined {
  switch (nodeType) {
    case "action_update_lead":
      return <UpdateLeadPreview config={config} />;
    default:
      return undefined;
  }
}
