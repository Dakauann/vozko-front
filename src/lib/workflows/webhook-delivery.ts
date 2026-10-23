import type { StatusChipTone } from "@/components/elevated-design/status-chip";

import type { WebhookDeliveryOutcome } from "./types";

type Translate = (key: string, values?: Record<string, string>) => string;

const REASON_KEYS: Record<string, string> = {
  workflow_not_active: "workflowNotActive",
  entry_not_found: "entryNotFound",
  unauthorized: "unauthorized",
  webhook_inactive: "webhookInactive",
  webhook_not_found: "webhookNotFound",
  method_not_allowed: "methodNotAllowed",
  entry_required: "entryRequired",
  entry_forbidden: "entryForbidden",
  lead_contact_required: "leadContactRequired",
  lead_phone_invalid: "leadPhoneInvalid",
  lead_not_found: "leadNotFound",
  trigger_invalid: "triggerInvalid",
  no_trigger_node: "noTriggerNode",
  workspace_at_capacity: "workspaceAtCapacity",
  internal_error: "internalError",
};

export function webhookReasonLabel(reason: string | undefined, t: Translate): string | null {
  if (!reason) return null;
  const key = REASON_KEYS[reason];
  return key ? t(`reasons.${key}`) : t("reasons.unknown", { reason });
}

const RESOLUTION_KEYS: Record<string, string> = {
  phone: "byPhone",
  lead_phone: "byLeadPhone",
  lead_email: "byLeadEmail",
};

export function webhookResolutionLabel(resolution: string | undefined, t: Translate): string | null {
  const key = resolution ? RESOLUTION_KEYS[resolution] : undefined;
  return key ? t(key) : null;
}

const OUTCOMES: Record<WebhookDeliveryOutcome, { key: string; tone: StatusChipTone }> = {
  accepted: { key: "accepted", tone: "healthy" },
  duplicate: { key: "duplicate", tone: "muted" },
  already_running: { key: "alreadyRunning", tone: "muted" },
  ignored: { key: "ignored", tone: "muted" },
  rejected: { key: "rejected", tone: "fault" },
};

export function webhookOutcomeLabel(outcome: WebhookDeliveryOutcome, t: Translate): { label: string; tone: StatusChipTone } {
  const known = OUTCOMES[outcome] ?? OUTCOMES.rejected;
  return { label: t(`outcomes.${known.key}`), tone: known.tone };
}
