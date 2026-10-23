"use client";

import { EmptyPreview } from "../message-node-primitives";
import { DecisionBlock, Op } from "./decision-block";
import { useConfigOptionLabel } from "./node-definitions";

export function ConditionBranchPreview({
  config,
}: {
  config: Record<string, unknown>;
}) {
  const variable = (config.variable as string) || "";
  const operator = (config.operator as string) || "";
  const op = useConfigOptionLabel("condition_branch", "operator", operator) || operator || "=";
  const value = (config.value as string) || "";
  if (!variable.trim()) return <EmptyPreview label="Sem condição" />;
  return (
    <DecisionBlock>
      {variable} <Op>{op}</Op> {value.trim() || "?"}
    </DecisionBlock>
  );
}
