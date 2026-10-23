import type { AudienceDraft } from "@/lib/campaign-audience/draft";
import type { AudienceSpec } from "@/lib/campaign-audience/types";
import type { CampaignDraft } from "@/lib/campaign-drafts/types";
import type { ButtonActionInput, ButtonChoices } from "@/lib/whatsapp-templates/exit";

import type { SmartPolicy } from "./smart";

export const WHATSAPP_WIZARD_STEPS = ["config", "message", "audience", "review", "send"] as const;

export type WhatsAppWizardStep = (typeof WHATSAPP_WIZARD_STEPS)[number];

export const REVIEWED_STEPS: readonly WhatsAppWizardStep[] = ["review", "send"];

export interface WhatsAppWizardValues {
  name: string;
  templateId: string;
  businessPhoneId: string;
  agentId?: string | null;
  workflowId?: string | null;
  enableAgentResponses: boolean;
  showTemplateInCrm: boolean;
  enableAnalysis: boolean;
  enableAutoStaging: boolean;
  enableAutoMemory: boolean;
  aiModel?: string;
}

export interface WhatsAppWizardState {
  values: WhatsAppWizardValues;
  responseMode: "agent" | "workflow";
  pipelineId: string;
  dealPipelineId: string;
  templateInfoConfirmed: boolean;
  audience: AudienceDraft;
  exit: { templateId: string; choices: ButtonChoices; acknowledged: boolean };
  smartPolicy: SmartPolicy | null;
}

export type WhatsAppWizardRequest = Record<string, unknown>;

export type WhatsAppCampaignDraft = CampaignDraft<WhatsAppWizardRequest, WhatsAppWizardState>;

export function wizardRequestOf(
  settings: Record<string, unknown>,
  { recipients, dealPipelineId, buttonRoutes }: { recipients: AudienceSpec | null; dealPipelineId: string; buttonRoutes: readonly ButtonActionInput[] },
): WhatsAppWizardRequest {
  const request: WhatsAppWizardRequest = {};
  for (const [key, value] of Object.entries(settings)) {
    if (key !== "scheduledStart" && value !== undefined) request[key] = value;
  }
  if (recipients) request.recipients = recipients;
  if (dealPipelineId) request.dealPipelineId = dealPipelineId;
  if (buttonRoutes.length > 0) request.buttonRoutes = buttonRoutes;
  return request;
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .flatMap((key) => {
          const item = (value as Record<string, unknown>)[key];
          return item === undefined ? [] : [[key, sorted(item)]];
        }),
    );
  }
  return value;
}

export function stableFingerprint(value: unknown): string {
  return JSON.stringify(sorted(value));
}

export function wizardHref(draftId: string | null, step?: WhatsAppWizardStep): string {
  const params = new URLSearchParams();
  if (draftId) params.set("draft", draftId);
  if (step) params.set("step", step);
  const query = params.toString();
  return query ? `/dashboard/whatsapp-campaigns/new?${query}` : "/dashboard/whatsapp-campaigns/new";
}

export function launchRefusalCodes(details: { blocks: readonly string[]; confirms: readonly string[]; findings?: unknown }): string[] {
  const findings = Array.isArray(details.findings) ? details.findings : [];
  const fromFindings = findings.flatMap((finding) => {
    const item = finding as { code?: unknown; level?: unknown };
    return typeof item.code === "string" && item.level !== "advice" ? [item.code] : [];
  });
  const codes = fromFindings.length > 0 ? fromFindings : [...details.blocks, ...details.confirms];
  return [...new Set(codes)];
}
