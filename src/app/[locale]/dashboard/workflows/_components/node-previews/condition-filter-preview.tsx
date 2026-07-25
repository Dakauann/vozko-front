"use client";

import { EmptyPreview } from "../message-node-primitives";
import { DecisionBlock, Op } from "./decision-block";

// condition_filter: a pass/block gate on a value.
export function ConditionFilterPreview({
  config,
}: {
  config: Record<string, unknown>;
}) {
  const variable = (config.variable as string) || "";
  const op =
    (config._display_operator as string) || (config.operator as string) || "=";
  const value = (config.value as string) || "";
  if (!variable.trim()) return <EmptyPreview label="Sem filtro" />;
  return (
    <DecisionBlock>
      {variable} <Op>{op}</Op> {value.trim() || "?"}
    </DecisionBlock>
  );
}
