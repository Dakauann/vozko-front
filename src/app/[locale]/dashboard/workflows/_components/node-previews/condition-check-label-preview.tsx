"use client";

import { EmptyPreview } from "../message-node-primitives";
import { DecisionBlock } from "./decision-block";

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

const DEAL_STATUS_LABELS: Record<string, string> = {
  open: "Oportunidade aberta",
  won: "Oportunidade ganha",
  lost: "Oportunidade perdida",
};

export function ConditionCheckOpportunityPreview({
  config,
}: {
  config: Record<string, unknown>;
}) {
  switch (config.check) {
    case "status":
      return DEAL_STATUS_LABELS[String(config.status)] ? (
        <DecisionBlock>{DEAL_STATUS_LABELS[String(config.status)]}</DecisionBlock>
      ) : (
        <EmptyPreview label="Sem situação" />
      );
    case "stage":
      return <ConditionPickPreview config={config} field="stage_id" emptyLabel="Sem etapa da oportunidade" />;
    default:
      return <DecisionBlock>Tem oportunidade</DecisionBlock>;
  }
}

export function ConditionCheckLabelPreview({
  config,
}: {
  config: Record<string, unknown>;
}) {
  return <ConditionPickPreview config={config} field="label_id" emptyLabel="Sem etiqueta" />;
}
