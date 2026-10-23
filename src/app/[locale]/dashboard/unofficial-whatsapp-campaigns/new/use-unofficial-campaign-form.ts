"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";

import { listAgentsAction } from "@/app/actions/agents";
import { listPipelinesAction } from "@/app/actions/crm-board";
import { getWorkspaceGroupAction } from "@/app/actions/unofficial-whatsapp-groups";
import { listWorkflowsAction } from "@/app/actions/workflows";
import { useCreateBlockedText } from "@/components/campaign-audience/CampaignAudienceStep";
import { useCampaignAudience } from "@/components/campaign-audience/use-campaign-audience";
import { useSelectionSendRefusalText } from "@/components/campaigns/SelectionSendNote";
import type { ElevatedCommandOption } from "@/components/elevated-design/elevated-command-select";
import { messageBodiesReady, parameterCount } from "@/components/unofficial-whatsapp/campaign-message-composer";
import { useUnofficialInstanceSelect } from "@/components/unofficial-whatsapp/instance-select";
import { useAuth } from "@/contexts/auth-context";
import { usePaginatedSelect } from "@/hooks/use-paginated-select";
import type { AgentListItem } from "@/lib/agents/types";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { CAMPAIGN_AUDIENCE_ERROR_CODES } from "@/lib/campaign-audience/errors";
import { selectionSendControls } from "@/lib/campaigns/selection-send";
import { instanceIssue, instanceUnusable } from "@/lib/unofficial-whatsapp/types";
import { UNOFFICIAL_CAMPAIGN_NEEDS_EXIT, messageExitPending } from "@/lib/unofficial-whatsapp-campaigns/exit-line";
import { blocksForGood, groupPosting, type GroupPrefill } from "@/lib/unofficial-whatsapp-campaigns/group-audience";
import { seededOutcomeCounts } from "@/lib/unofficial-whatsapp-campaigns/statuses";
import type { UnofficialWhatsAppCampaign, UnofficialWhatsAppCampaignAudience, UnofficialWhatsAppMessageSpec } from "@/lib/unofficial-whatsapp-campaigns/types";
import type { Workflow } from "@/lib/workflows/types";

import { campaignPayload, type CampaignFormSeed, type CampaignFormValues, type FormMode, type PacingDraft, type ResponseMode, type SeedOutcomeDraft } from "./campaign-form-model";
import { pickedFromGroup, type PickedCampaignGroup } from "./group-picks";

const AUDIENCE_CODES: readonly string[] = CAMPAIGN_AUDIENCE_ERROR_CODES;

export interface UnofficialCampaignFormOptions {
  mode: FormMode;
  seed: CampaignFormSeed;
  initialCampaign?: UnofficialWhatsAppCampaign | null;
  groupPrefill?: GroupPrefill | null;
}

export function useUnofficialCampaignForm({ mode, seed, initialCampaign = null, groupPrefill = null }: UnofficialCampaignFormOptions) {
  const t = useTranslations("unofficialWhatsappCampaigns");
  const tAudience = useTranslations("campaignAudience");
  const refusalText = useSelectionSendRefusalText();
  const contentLocked = mode === "edit" && !selectionSendControls(initialCampaign?.source, initialCampaign?.status ?? "").editContent;

  const form = useForm<CampaignFormValues>({ defaultValues: seed.values });
  const { watch, setValue } = form;

  const [message, setMessage] = useState<UnofficialWhatsAppMessageSpec>(seed.message);
  const [audience, setAudience] = useState<UnofficialWhatsAppCampaignAudience>(seed.audience);
  const isGroups = audience === "groups";
  const groupsAudienceRef = useRef(isGroups);
  groupsAudienceRef.current = isGroups;
  const [pickedGroups, setPickedGroups] = useState<PickedCampaignGroup[]>(seed.pickedGroups);
  const [prefillSkipped, setPrefillSkipped] = useState(0);
  const prefillResolvedRef = useRef(false);
  const [responseMode, setResponseModeState] = useState<ResponseMode>(seed.responseMode);
  const [scheduleEnabled, setScheduleEnabled] = useState(seed.scheduleEnabled);
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [pacing, setPacingState] = useState<PacingDraft>(seed.pacing);
  const [seedOutcome, setSeedOutcome] = useState<SeedOutcomeDraft>(seed.seed);
  const [dealPipelineId, setDealPipelineId] = useState(seed.dealPipelineId);

  const instanceId = watch("instanceId");
  const enableAnalysis = watch("enableAnalysis");
  const enableAutoStaging = watch("enableAutoStaging");
  const enableAutoMemory = watch("enableAutoMemory");

  const instanceSelect = useUnofficialInstanceSelect();

  const agentSelect = usePaginatedSelect<AgentListItem>({
    fetchFn: useCallback(async (page: number, search: string) => {
      const result = await listAgentsAction({ page, pageSize: 20, search: search || undefined });
      return { items: result.agents ?? [], totalPages: result.meta.totalPages };
    }, []),
    mapOption: useCallback((agent: AgentListItem): ElevatedCommandOption => ({ value: agent.id, label: agent.name }), []),
  });

  const workflowSelect = usePaginatedSelect<Workflow>({
    fetchFn: useCallback(async (page: number, search: string) => {
      const result = await listWorkflowsAction({ page, pageSize: 20, search: search || undefined });
      return { items: result.workflows ?? [], totalPages: result.meta.totalPages };
    }, []),
    mapOption: useCallback((workflow: Workflow): ElevatedCommandOption => ({ value: workflow.id, label: workflow.name }), []),
  });

  useEffect(() => {
    listPipelinesAction("conversation").then(({ pipelines: found }) => {
      setPipelines((found ?? []).map((p) => ({ id: p.id, name: p.name })));
    });
  }, []);

  useEffect(() => {
    if (mode !== "create" || !groupPrefill || groupPrefill.groupIds.length === 0) return;
    if (prefillResolvedRef.current) return;
    prefillResolvedRef.current = true;
    const { groupIds } = groupPrefill;
    void Promise.all(groupIds.map((id) => getWorkspaceGroupAction(id))).then((results) => {
      const resolved = results.flatMap((result): PickedCampaignGroup[] => {
        const detail = result.data;
        if (!detail || blocksForGood(groupPosting(detail).block)) return [];
        return [pickedFromGroup(detail.group, detail.runningCampaigns)];
      });
      setPickedGroups((current) => [...current, ...resolved.filter((group) => !current.some((picked) => picked.id === group.id))]);
      setPrefillSkipped(groupIds.length - resolved.length);
    });
  }, [mode, groupPrefill]);

  const selectedInstance = useMemo(() => instanceSelect.items.find((i) => i.id === instanceId) ?? null, [instanceSelect.items, instanceId]);

  const requiredVariables = parameterCount(message);
  const bodiesReady = messageBodiesReady(message);
  const exitPending = !isGroups && messageExitPending(message, mode === "edit" ? initialCampaign?.message : undefined);

  const automationId = watch(responseMode === "agent" ? "agentId" : "workflowId");
  const audienceFields = useMemo(
    () => ({
      message,
      ...(instanceId ? { instanceId } : {}),
      ...(automationId ? (responseMode === "agent" ? { agentId: automationId } : { workflowId: automationId }) : {}),
    }),
    [message, instanceId, responseMode, automationId],
  );
  const leadsAudience = useCampaignAudience({ channel: "unofficial", fields: audienceFields, scope: String(requiredVariables), initial: seed.audienceDraft });
  const blockedText = useCreateBlockedText(leadsAudience);
  const leadsCreate = mode === "create" && !isGroups;
  const sendable = leadsAudience.count?.sendable ?? 0;

  const { user } = useAuth();
  const canSeedOutcome = mode === "create" && user?.role === "admin";
  const seedOn = canSeedOutcome && seedOutcome.on && !isGroups;
  const seedOverflow = seedOn && seedOutcome.sentPercent + seedOutcome.failedPercent > 100;
  const seedCounts = seededOutcomeCounts(sendable, seedOutcome.sentPercent, seedOutcome.failedPercent);

  const issue = selectedInstance && !isGroups ? instanceIssue(selectedInstance) : null;
  const numberUnusable = instanceUnusable(issue);

  const setResponseMode = useCallback(
    (next: ResponseMode) => {
      setResponseModeState(next);
      setValue(next === "agent" ? "workflowId" : "agentId", null);
    },
    [setValue],
  );

  const setPacing = useCallback((patch: Partial<PacingDraft>) => setPacingState((current) => ({ ...current, ...patch })), []);

  const refusalOf = useCallback(
    (code: string | undefined, error: string) => {
      if (code === UNOFFICIAL_CAMPAIGN_NEEDS_EXIT) return t("form.exitLine.refused");
      const fallback = refusalText(code, error);
      return code && AUDIENCE_CODES.includes(code) ? codedErrorMessage(tAudience, { code }, fallback) : fallback;
    },
    [t, tAudience, refusalText],
  );

  const messageGate = (): string | null => {
    if (!bodiesReady) return t("form.variantsMismatch");
    if (exitPending) return t("form.exitLine.refused");
    if (isGroups && requiredVariables > 0) return t("form.groups.noVariables");
    return null;
  };

  const audienceGate = (): string | null => {
    if (seedOverflow) return t("form.seedOutcomeOverflow");
    if (mode === "create" && isGroups && pickedGroups.length === 0) return t("form.groups.noGroups");
    if (leadsCreate && blockedText !== null) return blockedText;
    return null;
  };

  const payload = (values: CampaignFormValues) =>
    campaignPayload({
      mode,
      values,
      audience,
      message,
      responseMode,
      scheduleEnabled,
      contentLocked,
      pacing,
      pickedGroups,
      recipients: leadsAudience.recipients,
      seed: seedOn ? seedOutcome : null,
    });

  return {
    mode,
    form,
    contentLocked,
    message,
    setMessage,
    audience,
    setAudience,
    isGroups,
    groupsAudienceRef,
    pickedGroups,
    setPickedGroups,
    prefillSkipped,
    responseMode,
    setResponseMode,
    scheduleEnabled,
    setScheduleEnabled,
    pipelines,
    pacing,
    setPacing,
    seedOutcome,
    setSeedOutcome,
    dealPipelineId,
    setDealPipelineId,
    instanceSelect,
    agentSelect,
    workflowSelect,
    selectedInstance,
    requiredVariables,
    bodiesReady,
    exitPending,
    enableAnalysis,
    enableAutoStaging,
    enableAutoMemory,
    leadsAudience,
    blockedText,
    leadsCreate,
    sendable,
    canSeedOutcome,
    seedOn,
    seedOverflow,
    seedCounts,
    issue,
    numberUnusable,
    refusalOf,
    messageGate,
    audienceGate,
    payload,
  };
}

export type UnofficialCampaignForm = ReturnType<typeof useUnofficialCampaignForm>;
