"use client";

import { EmptyPreview } from "../message-node-primitives";
import { DecisionBlock } from "./decision-block";

export function ConditionCheckLabelPreview({
  config,
}: {
  config: Record<string, unknown>;
}) {
  const label =
    (config._display_label_id as string) || (config.label_id as string) || "";
  if (!label.trim()) return <EmptyPreview label="Sem etiqueta" />;
  return <DecisionBlock>{label}</DecisionBlock>;
}
