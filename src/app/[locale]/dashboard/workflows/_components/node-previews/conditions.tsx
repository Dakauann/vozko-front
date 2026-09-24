"use client";

import type { ReactNode } from "react";
import type { WorkflowNodeType } from "@/lib/workflows/types";

import { ConditionBranchPreview } from "./condition-branch-preview";
import { ConditionFilterPreview } from "./condition-filter-preview";
import { ConditionTextMatchPreview } from "./condition-text-match-preview";
import {
  ConditionCheckLabelPreview,
  ConditionPickPreview,
} from "./condition-check-label-preview";

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
    case "condition_check_stage":
      return <ConditionPickPreview config={config} field="stage_id" emptyLabel="Sem etapa" />;
    default:
      return undefined;
  }
}
