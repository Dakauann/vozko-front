"use client";

import type { ReactNode } from "react";
import { templateButtonIndexOf } from "@/lib/workflows/template-button";
import type { WorkflowNodeType } from "@/lib/workflows/types";

import { ConditionBranchPreview } from "./condition-branch-preview";
import { ConditionFilterPreview } from "./condition-filter-preview";
import { ConditionTextMatchPreview } from "./condition-text-match-preview";
import { TemplateButtonBranchPreview } from "./template-button-branch-preview";
import {
  ConditionCheckLabelPreview,
  ConditionCheckOpportunityPreview,
  ConditionPickPreview,
} from "./condition-check-label-preview";

export function renderConditionContentPreview(
  nodeType: WorkflowNodeType,
  config: Record<string, unknown>,
): ReactNode | undefined {
  switch (nodeType) {
    case "condition_branch": {
      const button = templateButtonIndexOf(config);
      return button === null ? <ConditionBranchPreview config={config} /> : <TemplateButtonBranchPreview index={button} />;
    }
    case "condition_filter":
      return <ConditionFilterPreview config={config} />;
    case "condition_text_match":
      return <ConditionTextMatchPreview config={config} />;
    case "condition_check_label":
      return <ConditionCheckLabelPreview config={config} />;
    case "condition_check_stage":
      return <ConditionPickPreview config={config} field="stage_id" emptyLabel="Sem etapa" />;
    case "condition_check_opportunity":
      return <ConditionCheckOpportunityPreview config={config} />;
    default:
      return undefined;
  }
}
