import type { FormSummary } from "@/lib/whatsapp-forms/types";

import type { HandleDefinition, WorkflowNodeType } from "./types";

export const SEND_FORM_NODE = "action_send_form";

export const FORM_SUBMITTED_TRIGGER = "trigger_form_submitted";

export const SEND_FORM_OUTPUTS = ["completed", "no_reply", "send_failed"] as const;

export type SendFormOutput = (typeof SEND_FORM_OUTPUTS)[number];

export const SEND_FORM_CONFIG_KEYS = ["form_id", "header", "body", "footer", "cta", "timeout_seconds", "fallback_template_id"] as const;

export const FORM_TRIGGER_CONFIG_KEYS = ["form_ids"] as const;

export const DEFAULT_FORM_TIMEOUT_SECONDS = 86_400;

export interface SendFormConfig {
  form_id: string;
  header: string;
  body: string;
  footer: string;
  cta: string;
  timeout_seconds: number;
  fallback_template_id: string;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function seconds(value: unknown): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : DEFAULT_FORM_TIMEOUT_SECONDS;
}

export function readSendFormConfig(config: Record<string, unknown>): SendFormConfig {
  return {
    form_id: text(config.form_id),
    header: text(config.header),
    body: text(config.body),
    footer: text(config.footer),
    cta: text(config.cta),
    timeout_seconds: seconds(config.timeout_seconds),
    fallback_template_id: text(config.fallback_template_id),
  };
}

export function formTriggerIds(config: Record<string, unknown>): string[] {
  const ids = config.form_ids;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string" && id !== "") : [];
}

export function publishedForms(items: readonly FormSummary[]): FormSummary[] {
  return items.filter((item) => Boolean(item.form.publishedVersionId) && !item.form.archivedAt);
}

export function isSendFormOutput(id: string): id is SendFormOutput {
  return (SEND_FORM_OUTPUTS as readonly string[]).includes(id);
}

export function declaredOutputs(nodeType: WorkflowNodeType, outputs: HandleDefinition[] | undefined): HandleDefinition[] | undefined {
  if (outputs?.length || nodeType !== SEND_FORM_NODE) return outputs;
  return SEND_FORM_OUTPUTS.map((id) => ({ id, label: id }));
}

export function sendFormIncomplete(config: Record<string, unknown>): boolean {
  const form = readSendFormConfig(config);
  return !form.form_id || !form.body.trim() || !form.cta.trim();
}
