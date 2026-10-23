import type { AudienceDraft } from "@/lib/campaign-audience/draft";
import type { AudienceSpec } from "@/lib/campaign-audience/types";
import type { CampaignDraft } from "@/lib/campaign-drafts/types";
import { groupTargets, type GroupPrefill } from "@/lib/unofficial-whatsapp-campaigns/group-audience";
import type {
  UnofficialWhatsAppCampaign,
  UnofficialWhatsAppCampaignAudience,
  UnofficialWhatsAppCampaignPayload,
  UnofficialWhatsAppMessageSpec,
} from "@/lib/unofficial-whatsapp-campaigns/types";

import { campaignPipelineId, type PickedCampaignGroup } from "./group-picks";

export type ResponseMode = "agent" | "workflow";

export type FormMode = "create" | "edit";

export interface CampaignFormValues {
  name: string;
  instanceId: string;
  pipelineId: string;
  agentId: string | null;
  workflowId: string | null;
  enableAgentResponses: boolean;
  enableWorkflow: boolean;
  enableAnalysis: boolean;
  enableAutoStaging: boolean;
  enableAutoMemory: boolean;
  aiModel: string;
  scheduledStart: string | null;
}

export interface PacingDraft {
  minMs: number;
  maxMs: number;
  dailyCap: number;
}

export interface SeedOutcomeDraft {
  on: boolean;
  sentPercent: number;
  failedPercent: number;
}

export interface CampaignFormSeed {
  values: CampaignFormValues;
  message: UnofficialWhatsAppMessageSpec;
  audience: UnofficialWhatsAppCampaignAudience;
  responseMode: ResponseMode;
  scheduleEnabled: boolean;
  pacing: PacingDraft;
  dealPipelineId: string;
  pickedGroups: PickedCampaignGroup[];
  audienceDraft?: AudienceDraft;
  seed: SeedOutcomeDraft;
}

export const EMPTY_MESSAGE: UnofficialWhatsAppMessageSpec = { kind: "text", bodies: [""] };

export const DEFAULT_SEED: SeedOutcomeDraft = { on: false, sentPercent: 40, failedPercent: 10 };

export interface DefaultPacing {
  min: number;
  max: number;
}

export function seedFromCampaign(campaign: UnofficialWhatsAppCampaign, pacing: DefaultPacing): CampaignFormSeed {
  return {
    values: {
      name: campaign.name ?? "",
      instanceId: campaign.instanceId ?? "",
      pipelineId: campaign.pipelineId ?? "",
      agentId: campaign.agentId ?? null,
      workflowId: campaign.workflowId ?? null,
      enableAgentResponses: campaign.enableAgentResponses ?? false,
      enableWorkflow: campaign.enableWorkflow ?? false,
      enableAnalysis: campaign.enableAnalysis ?? false,
      enableAutoStaging: campaign.enableAutoStaging ?? false,
      enableAutoMemory: campaign.enableAutoMemory ?? false,
      aiModel: campaign.aiModel ?? "",
      scheduledStart: campaign.scheduledStart ?? null,
    },
    message: campaign.message ?? EMPTY_MESSAGE,
    audience: campaign.audience ?? "leads",
    responseMode: campaign.enableWorkflow ? "workflow" : "agent",
    scheduleEnabled: Boolean(campaign.scheduledStart),
    pacing: { minMs: campaign.sendDelayMinMs ?? pacing.min, maxMs: campaign.sendDelayMaxMs ?? pacing.max, dailyCap: campaign.dailyCap ?? 0 },
    dealPipelineId: "",
    pickedGroups: [],
    seed: DEFAULT_SEED,
  };
}

const BLANK_VALUES: CampaignFormValues = {
  name: "",
  instanceId: "",
  pipelineId: "",
  agentId: null,
  workflowId: null,
  enableAgentResponses: false,
  enableWorkflow: false,
  enableAnalysis: false,
  enableAutoStaging: false,
  enableAutoMemory: false,
  aiModel: "",
  scheduledStart: null,
};

export function emptySeed(groupPrefill: GroupPrefill | null, pacing: DefaultPacing): CampaignFormSeed {
  return {
    values: BLANK_VALUES,
    message: EMPTY_MESSAGE,
    audience: groupPrefill ? "groups" : "leads",
    responseMode: "agent",
    scheduleEnabled: false,
    pacing: { minMs: pacing.min, maxMs: pacing.max, dailyCap: 0 },
    dealPipelineId: "",
    pickedGroups: [],
    seed: DEFAULT_SEED,
  };
}

export interface PayloadInput {
  mode: FormMode;
  values: CampaignFormValues;
  audience: UnofficialWhatsAppCampaignAudience;
  message: UnofficialWhatsAppMessageSpec;
  responseMode: ResponseMode;
  scheduleEnabled: boolean;
  contentLocked: boolean;
  pacing: PacingDraft;
  pickedGroups: readonly PickedCampaignGroup[];
  recipients: AudienceSpec | null;
  seed: SeedOutcomeDraft | null;
}

export function campaignPayload(input: PayloadInput): UnofficialWhatsAppCampaignPayload {
  const { mode, values, audience, responseMode, pacing } = input;
  const isGroups = audience === "groups";
  const leadsCreate = mode === "create" && !isGroups;
  return {
    name: values.name.trim(),
    audience: mode === "create" && isGroups ? audience : undefined,
    instanceId: isGroups ? undefined : values.instanceId,
    message: input.message,
    pipelineId: campaignPipelineId(isGroups, values.pipelineId),
    agentId: responseMode === "agent" ? values.agentId : null,
    workflowId: responseMode === "workflow" ? values.workflowId : null,
    enableAgentResponses: responseMode === "agent" && Boolean(values.agentId),
    enableWorkflow: responseMode === "workflow" && Boolean(values.workflowId),
    enableAnalysis: values.enableAnalysis,
    enableAutoStaging: values.enableAutoStaging,
    enableAutoMemory: values.enableAutoMemory,
    aiModel: values.aiModel || undefined,
    scheduledStart: input.scheduleEnabled && !input.contentLocked ? values.scheduledStart : null,
    sendDelayMinMs: pacing.minMs,
    sendDelayMaxMs: pacing.maxMs,
    dailyCap: pacing.dailyCap,
    targets: isGroups ? groupTargets(mode === "create" ? [...input.pickedGroups] : []) : [],
    recipients: leadsCreate ? (input.recipients ?? undefined) : undefined,
    seedOutcome: input.seed ? { sentPercent: input.seed.sentPercent, failedPercent: input.seed.failedPercent } : undefined,
  };
}

export type WizardStep = "config" | "message" | "audience" | "review" | "send";

export const WIZARD_STEPS: readonly WizardStep[] = ["config", "message", "audience", "review", "send"];

export type WizardRequest = UnofficialWhatsAppCampaignPayload & { dealPipelineId?: string };

export interface WizardState {
  step: WizardStep;
  responseMode: ResponseMode;
  pickedGroups: PickedCampaignGroup[];
  audienceDraft?: AudienceDraft;
  seed: SeedOutcomeDraft;
}

export type UnofficialCampaignDraft = CampaignDraft<WizardRequest, WizardState>;

export function wizardRequest(payload: UnofficialWhatsAppCampaignPayload, dealPipelineId: string): WizardRequest {
  const request: WizardRequest = { ...payload };
  delete request.scheduledStart;
  return dealPipelineId ? { ...request, dealPipelineId } : request;
}

function wizardStepOf(value: unknown): WizardStep {
  return WIZARD_STEPS.find((step) => step === value) ?? "config";
}

export function seedFromDraft(draft: UnofficialCampaignDraft, pacing: DefaultPacing): { seed: CampaignFormSeed; step: WizardStep } {
  const request = draft.payload.request;
  const state = draft.payload.state;
  const base = emptySeed(null, pacing);
  if (!request) return { seed: { ...base, values: { ...base.values, name: draft.name } }, step: wizardStepOf(state?.step) };
  const audience: UnofficialWhatsAppCampaignAudience = request.audience === "groups" ? "groups" : "leads";
  return {
    step: wizardStepOf(state?.step),
    seed: {
      values: {
        name: request.name ?? draft.name,
        instanceId: request.instanceId ?? "",
        pipelineId: request.pipelineId ?? "",
        agentId: request.agentId ?? null,
        workflowId: request.workflowId ?? null,
        enableAgentResponses: request.enableAgentResponses ?? false,
        enableWorkflow: request.enableWorkflow ?? false,
        enableAnalysis: request.enableAnalysis ?? false,
        enableAutoStaging: request.enableAutoStaging ?? false,
        enableAutoMemory: request.enableAutoMemory ?? false,
        aiModel: request.aiModel ?? "",
        scheduledStart: null,
      },
      message: request.message ?? EMPTY_MESSAGE,
      audience,
      responseMode: state?.responseMode ?? (request.enableWorkflow ? "workflow" : "agent"),
      scheduleEnabled: false,
      pacing: {
        minMs: request.sendDelayMinMs ?? pacing.min,
        maxMs: request.sendDelayMaxMs ?? pacing.max,
        dailyCap: request.dailyCap ?? 0,
      },
      dealPipelineId: request.dealPipelineId ?? "",
      pickedGroups: state?.pickedGroups ?? [],
      audienceDraft: state?.audienceDraft,
      seed: state?.seed ?? DEFAULT_SEED,
    },
  };
}
