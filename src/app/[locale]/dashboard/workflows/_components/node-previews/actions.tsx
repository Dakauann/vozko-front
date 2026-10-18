"use client";

import type { ReactNode } from "react";
import type { WorkflowNodeType } from "@/lib/workflows/types";

import { ConsentPreview } from "./consent-preview";
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
    default:
      return undefined;
  }
}
