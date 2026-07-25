"use client";

import type { ReactNode } from "react";
import type { WorkflowNodeType } from "@/lib/workflows/types";

import { ConditionBranchPreview } from "./condition-branch-preview";
import { ConditionFilterPreview } from "./condition-filter-preview";
import { ConditionTextMatchPreview } from "./condition-text-match-preview";
import { ConditionCheckLabelPreview } from "./condition-check-label-preview";

// renderConditionContentPreview maps a condition/branch node to its DecisionBlock
// content (rendered inside the generic node card, above the output rows). Returns
// undefined for non-condition nodes so the caller falls through to its switch.
export function renderConditionContentPreview(
  nodeType: WorkflowNodeType,
  config: Record<string, unknown>,
): ReactNode | undefined {
  switch (nodeType) {
    case "condition_branch":
      return <ConditionBranchPreview config={config} />;
    case "condition_filter":
      return <ConditionFilterPreview config={config} />;
    case "condition_text_match":
      return <ConditionTextMatchPreview config={config} />;
    case "condition_check_label":
      return <ConditionCheckLabelPreview config={config} />;
    default:
      return undefined;
  }
}
