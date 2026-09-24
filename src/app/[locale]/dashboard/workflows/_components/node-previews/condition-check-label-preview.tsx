"use client";

import { EmptyPreview } from "../message-node-primitives";
import { DecisionBlock } from "./decision-block";

// ConditionPickPreview shows the item a compare node checks against, by the
// name picked in the editor (stored as _display_<field>).
export function ConditionPickPreview({
  config,
  field,
  emptyLabel,
}: {
  config: Record<string, unknown>;
  field: string;
  emptyLabel: string;
}) {
  const picked =
    (config[`_display_${field}`] as string) || (config[field] as string) || "";
  if (!picked.trim()) return <EmptyPreview label={emptyLabel} />;
  return <DecisionBlock>{picked}</DecisionBlock>;
}

export function ConditionCheckLabelPreview({
  config,
}: {
  config: Record<string, unknown>;
}) {
  return <ConditionPickPreview config={config} field="label_id" emptyLabel="Sem etiqueta" />;
}
