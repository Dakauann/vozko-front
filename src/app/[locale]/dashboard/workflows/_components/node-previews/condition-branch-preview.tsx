"use client";

import { EmptyPreview } from "../message-node-primitives";
import { DecisionBlock, Op } from "./decision-block";

// condition_branch: an if/else test → Verdadeiro / Falso branches (the rows).
export function ConditionBranchPreview({
  config,
}: {
  config: Record<string, unknown>;
}) {
  const variable = (config.variable as string) || "";
  const op =
    (config._display_operator as string) || (config.operator as string) || "=";
  const value = (config.value as string) || "";
  if (!variable.trim()) return <EmptyPreview label="Sem condição" />;
  return (
    <DecisionBlock>
      {variable} <Op>{op}</Op> {value.trim() || "?"}
    </DecisionBlock>
  );
}
