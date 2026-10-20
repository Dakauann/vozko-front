"use client";

import { Controller, useForm } from "react-hook-form";
import { DealAutomationDraft, DealAutomationSetting } from "@/components/channels/deal-automation-setting";
import { applyDealAutomation } from "@/lib/deal-automation/client";
import { DownloadSimple, UploadSimple } from "@/components/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AIModelSelector } from "@/components/elevated-design/ai-model-selector";
import Button from "@/components/elevated-design/button";
import { CampaignMediaPicker, MEDIA_ACCEPT } from "@/components/campaigns/CampaignMediaPicker";
import { SelectionSendNote, useSelectionSendRefusalText } from "@/components/campaigns/SelectionSendNote";
import { selectionSendControls } from "@/lib/campaigns/selection-send";
import {
  CampaignMessageComposer,
  messageBodiesReady,
  parameterCount,
} from "@/components/unofficial-whatsapp/campaign-message-composer";
import { CampaignPacingPanel, DEFAULT_SEND_DELAY_MS } from "@/components/unofficial-whatsapp/campaign-pacing-panel";
import { InstanceIssueLine, useUnofficialInstanceSelect } from "@/components/unofficial-whatsapp/instance-select";
import {
  ElevatedCommandSelect,
  type ElevatedCommandOption,
} from "@/components/elevated-design/elevated-command-select";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import GrainBackground from "@/components/elevated-design/grain-background";
import {
  TargetListEditor,
  parseTargetList,
  type ParsedTarget,
  type ParsedTargetList,
} from "@/components/campaigns/TargetListEditor";
import { CampaignContactList } from "@/components/campaigns/CampaignContactList";
import type { DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { OPEN_CONTACT_LIST_VIEW, type ContactListView } from "@/lib/campaigns/contact-list-view";
import { readDelimitedFile } from "@/lib/csv/parse";
import type { AgentListItem, ModelPricingInfo } from "@/lib/agents/types";
import type {
  UnofficialWhatsAppCampaign,
  UnofficialWhatsAppCampaignAudience,
  UnofficialWhatsAppMessageSpec,
} from "@/lib/unofficial-whatsapp-campaigns/types";
import {
  blocksForGood,
  groupPosting,
  groupTargets,
  type GroupPrefill,
} from "@/lib/unofficial-whatsapp-campaigns/group-audience";
import { getWorkspaceGroupAction } from "@/app/actions/unofficial-whatsapp-groups";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { Notice } from "@/components/ui/notice";
import { ExternalRiskNotice } from "@/components/unofficial-whatsapp-groups/kit/notices";
import { CampaignGroupPicker } from "./CampaignGroupPicker";
import { CampaignSendReview, pickedPlan, unsendableGroups } from "./CampaignSendReview";
import { campaignPipelineId, hasExternalPick, pickedFromGroup, type PickedCampaignGroup } from "./group-picks";
import { useCampaignEstimate } from "./use-campaign-estimate";
import type { Workflow } from "@/lib/workflows/types";
import { instanceIssue, instanceUnusable } from "@/lib/unofficial-whatsapp/types";
import { seededOutcomeCounts } from "@/lib/unofficial-whatsapp-campaigns/statuses";
import { UNOFFICIAL_CAMPAIGN_NEEDS_EXIT, messageExitPending } from "@/lib/unofficial-whatsapp-campaigns/exit-line";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import {
  createUnofficialCampaignAction,
  updateUnofficialCampaignAction,
} from "@/app/actions/unofficial-whatsapp-campaigns";
import { listAgentsAction } from "@/app/actions/agents";
import { listPipelinesAction } from "@/app/actions/crm-board";
import { listWorkflowsAction } from "@/app/actions/workflows";
import { usePaginatedSelect } from "@/hooks/use-paginated-select";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";


type FormValues = {
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
};

const EMPTY_MESSAGE: UnofficialWhatsAppMessageSpec = { kind: "text", bodies: [""] };

const EMPTY_PARSE: ParsedTargetList = {
  targets: [],
  skipped: [],
  duplicates: 0,
  invalid: 0,
  missingVariables: 0,
};

const isValidNumber = (digits: string) => digits.length >= 10 && digits.length <= 15;

const searchableTarget = (target: ParsedTarget) => [target.number, target.name];

const FieldError = ({ message }: { message?: string }) =>
  message ? (
    <p className="mt-1 text-xs font-semibold text-destructive-ink">{message}</p>
  ) : null;

export default function CreateUnofficialCampaignForm({
  mode = "create",
  initialCampaign,
  aiModels = [],
  modelPricing = [],
  groupPrefill = null,
}: {
  mode?: "create" | "edit";
  initialCampaign?: UnofficialWhatsAppCampaign | null;
  aiModels?: string[];
  modelPricing?: ModelPricingInfo[];
  groupPrefill?: GroupPrefill | null;
}) {
  const t = useTranslations("unofficialWhatsappCampaigns");
  const tDeals = useTranslations("dealAutomation");
  const router = useRouter();
  const refusalText = useSelectionSendRefusalText();
  const contentLocked =
    mode === "edit" && !selectionSendControls(initialCampaign?.source, initialCampaign?.status ?? "").editContent;

  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      name: initialCampaign?.name ?? "",
      instanceId: initialCampaign?.instanceId ?? "",
      pipelineId: initialCampaign?.pipelineId ?? "",
      agentId: initialCampaign?.agentId ?? null,
      workflowId: initialCampaign?.workflowId ?? null,
      enableAgentResponses: initialCampaign?.enableAgentResponses ?? false,
      enableWorkflow: initialCampaign?.enableWorkflow ?? false,
      enableAnalysis: initialCampaign?.enableAnalysis ?? false,
      enableAutoStaging: initialCampaign?.enableAutoStaging ?? false,
      enableAutoMemory: initialCampaign?.enableAutoMemory ?? false,
      aiModel: initialCampaign?.aiModel ?? "",
      scheduledStart: initialCampaign?.scheduledStart ?? null,
    },
  });

  const [message, setMessage] = useState<UnofficialWhatsAppMessageSpec>(
    initialCampaign?.message ?? EMPTY_MESSAGE,
  );
  const [audience, setAudience] = useState<UnofficialWhatsAppCampaignAudience>(
    mode === "edit" ? (initialCampaign?.audience ?? "leads") : groupPrefill ? "groups" : "leads",
  );
  const isGroups = audience === "groups";
  const groupsAudienceRef = useRef(isGroups);
  groupsAudienceRef.current = isGroups;
  const [pickedGroups, setPickedGroups] = useState<PickedCampaignGroup[]>([]);
  const [prefillSkipped, setPrefillSkipped] = useState(0);
  const prefillResolvedRef = useRef(false);
  const [rawTargets, setRawTargets] = useState("");
  const [recipientView, setRecipientView] = useState<ContactListView>(OPEN_CONTACT_LIST_VIEW);
  const [responseMode, setResponseMode] = useState<"agent" | "workflow">(
    initialCampaign?.enableWorkflow ? "workflow" : "agent",
  );
  const [scheduleEnabled, setScheduleEnabled] = useState(
    Boolean(initialCampaign?.scheduledStart),
  );
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [minMs, setMinMs] = useState<number>(initialCampaign?.sendDelayMinMs ?? DEFAULT_SEND_DELAY_MS.min);
  const [maxMs, setMaxMs] = useState<number>(initialCampaign?.sendDelayMaxMs ?? DEFAULT_SEND_DELAY_MS.max);
  const [dailyCap, setDailyCap] = useState(initialCampaign?.dailyCap ?? 0);

  const [seedOutcome, setSeedOutcome] = useState(false);
  const [dealPipelineId, setDealPipelineId] = useState("");
  const [sentPercent, setSentPercent] = useState(40);
  const [failedPercent, setFailedPercent] = useState(10);

  const csvInputRef = useRef<HTMLInputElement>(null);

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
    mapOption: useCallback(
      (agent: AgentListItem): ElevatedCommandOption => ({ value: agent.id, label: agent.name }),
      [],
    ),
  });

  const workflowSelect = usePaginatedSelect<Workflow>({
    fetchFn: useCallback(async (page: number, search: string) => {
      const result = await listWorkflowsAction({ page, pageSize: 20, search: search || undefined });
      return { items: result.workflows ?? [], totalPages: result.meta.totalPages };
    }, []),
    mapOption: useCallback(
      (workflow: Workflow): ElevatedCommandOption => ({ value: workflow.id, label: workflow.name }),
      [],
    ),
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
      setPickedGroups((current) => [
        ...current,
        ...resolved.filter((group) => !current.some((picked) => picked.id === group.id)),
      ]);
      setPrefillSkipped(groupIds.length - resolved.length);
    });
  }, [mode, groupPrefill]);

  const selectedInstance = useMemo(
    () => instanceSelect.items.find((i) => i.id === instanceId) ?? null,
    [instanceSelect.items, instanceId],
  );


  const requiredVariables = parameterCount(message);
  const bodiesReady = messageBodiesReady(message);
  const exitPending = !isGroups && messageExitPending(message, mode === "edit" ? initialCampaign?.message : undefined);

  const parsed = useMemo(
    () => (rawTargets ? parseTargetList(rawTargets, requiredVariables, isValidNumber) : EMPTY_PARSE),
    [rawTargets, requiredVariables],
  );

  const recipientVariableColumns = useMemo<DashboardTableColumn<ParsedTarget>[]>(() => {
    const count = parsed.targets.reduce((most, target) => Math.max(most, target.variables?.length ?? 0), 0);
    return Array.from({ length: count }, (_, index) => ({
      key: `variable-${index}`,
      header: t("form.recipientsVariable", { index: index + 1 }),
      render: (target: ParsedTarget) => target.variables?.[index],
    }));
  }, [parsed.targets, t]);

  const { user } = useAuth();
  const isSystemAdmin = user?.role === "admin";
  const canSeedOutcome = mode === "create" && isSystemAdmin;
  const seedOn = canSeedOutcome && seedOutcome && !isGroups;
  const seedOverflow = seedOn && sentPercent + failedPercent > 100;
  const seedCounts = seededOutcomeCounts(
    parsed.targets.length,
    sentPercent,
    failedPercent,
  );

  const issue = selectedInstance && !isGroups ? instanceIssue(selectedInstance) : null;
  const numberUnusable = instanceUnusable(issue);

  const estimateRequest = useMemo(() => {
    if (mode !== "create") return null;
    if (isGroups) {
      if (pickedGroups.length === 0) return null;
      return { audience: "groups" as const, groupJids: pickedGroups.map((group) => group.jid), sendDelayMinMs: minMs, sendDelayMaxMs: maxMs };
    }
    if (!instanceId || parsed.targets.length === 0) return null;
    return { audience: "leads" as const, instanceId, targets: parsed.targets.length, sendDelayMinMs: minMs, sendDelayMaxMs: maxMs };
  }, [mode, isGroups, pickedGroups, instanceId, parsed.targets.length, minMs, maxMs]);
  const estimate = useCampaignEstimate(estimateRequest);
  const unsendable = isGroups ? unsendableGroups(pickedPlan(estimate.draft?.groups, pickedGroups)) : 0;

  const handleDownloadCsvExample = () => {
    const header = ["numero", "nome", ...Array.from({ length: requiredVariables }, (_, i) => `variavel${i + 1}`)];
    const sample = ["5584999990001", "Ana", ...Array.from({ length: requiredVariables }, (_, i) => `valor${i + 1}`)];
    const csv = `${header.join(";")}\n${sample.join(";")}\n`;

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "exemplo-campanha.csv";
    link.click();
    URL.revokeObjectURL(url);
  };


  const onSubmit = handleSubmit(async (values) => {
    if (!bodiesReady) {
      toast.error(t("form.saveFailed"), { description: t("form.variantsMismatch") });
      return;
    }
    if (exitPending) {
      toast.error(t("form.saveFailed"), { description: t("form.exitLine.refused") });
      return;
    }
    if (seedOverflow) {
      toast.error(t("form.saveFailed"), { description: t("form.seedOutcomeOverflow") });
      return;
    }
    if (isGroups && requiredVariables > 0) {
      toast.error(t("form.saveFailed"), { description: t("form.groups.noVariables") });
      return;
    }
    if (mode === "create" && isGroups && pickedGroups.length === 0) {
      toast.error(t("form.saveFailed"), { description: t("form.groups.noGroups") });
      return;
    }
    if (mode === "create" && unsendable > 0) {
      toast.error(t("form.saveFailed"), { description: t("form.review.unsendable", { count: unsendable }) });
      return;
    }
    if (mode === "create" && !isGroups && parsed.targets.length === 0) {
      toast.error(t("form.saveFailed"), { description: t("form.noTargets") });
      return;
    }

    const payload = {
      name: values.name.trim(),
      audience: mode === "create" && isGroups ? audience : undefined,
      instanceId: isGroups ? undefined : values.instanceId,
      message,
      pipelineId: campaignPipelineId(isGroups, values.pipelineId),
      agentId: responseMode === "agent" ? values.agentId : null,
      workflowId: responseMode === "workflow" ? values.workflowId : null,
      enableAgentResponses: responseMode === "agent" && Boolean(values.agentId),
      enableWorkflow: responseMode === "workflow" && Boolean(values.workflowId),
      enableAnalysis: values.enableAnalysis,
      enableAutoStaging: values.enableAutoStaging,
      enableAutoMemory: values.enableAutoMemory,
      aiModel: values.aiModel || undefined,
      scheduledStart: scheduleEnabled && !contentLocked ? values.scheduledStart : null,
      sendDelayMinMs: minMs,
      sendDelayMaxMs: maxMs,
      dailyCap,
      targets: isGroups
        ? groupTargets(mode === "create" ? pickedGroups : [])
        : parsed.targets.map((target) => ({
            number: target.number,
            name: target.name,
            variables: target.variables,
          })),
      seedOutcome: seedOn ? { sentPercent, failedPercent } : undefined,
    };

    const result =
      mode === "edit" && initialCampaign
        ? await updateUnofficialCampaignAction(initialCampaign.id, payload)
        : await createUnofficialCampaignAction(payload);

    if (result.error) {
      const description = result.code === UNOFFICIAL_CAMPAIGN_NEEDS_EXIT ? t("form.exitLine.refused") : refusalText(result.code, result.error);
      toast.error(t("form.saveFailed"), { description });
      return;
    }
    const campaignId = result.campaign?.id;
    if (
      mode === "create" &&
      campaignId &&
      !(await applyDealAutomation(
        { entryType: "unofficial_whatsapp", kind: "campaign", containerId: campaignId },
        dealPipelineId,
      ))
    ) {
      toast.error(tDeals("notAppliedTitle"), { description: tDeals("notApplied") });
    }
    router.push(`/dashboard/unofficial-whatsapp-campaigns/${campaignId ?? ""}`);
  });

  const previewBody = message.bodies[0] ?? "";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <ElevatedContainer className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 font-display text-xl font-semibold tracking-[0.01em] text-foreground">
            {t("form.basicInfoTitle")}
          </h2>

          <div className="space-y-4">
            {contentLocked ? <SelectionSendNote reason="contentLocked" /> : null}
            <div>
              <ElevatedInput
                label={t("form.name")}
                controlSize="default"
                placeholder={t("form.namePlaceholder")}
                {...register("name", {
                  required: t("form.nameRequired"),
                  minLength: { value: 3, message: t("form.nameRequired") },
                })}
              />
              <FieldError message={errors.name?.message} />
            </div>

            {mode === "create" ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{t("form.audience.label")}</p>
                <ElevatedPillToggle<UnofficialWhatsAppCampaignAudience>
                  size="md"
                  value={audience}
                  onChange={setAudience}
                  aria-label={t("form.audience.label")}
                  options={[
                    { value: "leads", label: t("form.audience.leads") },
                    { value: "groups", label: t("form.audience.groups") },
                  ]}
                />
                <p className="text-xs text-muted-foreground">
                  {isGroups ? t("form.audience.groupsDescription") : t("form.audience.leadsDescription")}
                </p>
              </div>
            ) : null}

            {isGroups ? (
              <p className="text-xs text-muted-foreground">{t("form.groups.numberLocked")}</p>
            ) : (
              <div>
                <Controller
                  name="instanceId"
                  control={control}
                  rules={{ validate: (value) => groupsAudienceRef.current || Boolean(value) || t("form.numberRequired") }}
                  render={({ field }) => (
                    <ElevatedCommandSelect
                      label={t("form.number")}
                      value={field.value}
                      onValueChange={field.onChange}
                      options={instanceSelect.options}
                      searchPlaceholder={t("form.searchNumber")}
                      emptyMessage={t("form.noNumbers")}
                      onSearch={instanceSelect.onSearch}
                      onScrollEnd={instanceSelect.onScrollEnd}
                      onOpenChange={instanceSelect.onOpenChange}
                      isLoading={instanceSelect.isLoading}
                      disabled={contentLocked}
                    />
                  )}
                />
                <FieldError message={errors.instanceId?.message} />
                <p className="mt-1 text-xs text-muted-foreground">{t("form.numberDescription")}</p>
                <InstanceIssueLine issue={issue} className="mt-1.5" />
              </div>
            )}

            {isGroups ? (
              <p className="text-xs text-muted-foreground">{t("form.groups.funnelNotApplied")}</p>
            ) : pipelines.length > 0 ? (
              <div>
                <Controller
                  name="pipelineId"
                  control={control}
                  render={({ field }) => (
                    <ElevatedCommandSelect
                      label={t("form.pipeline")}
                      value={field.value}
                      onValueChange={field.onChange}
                      options={[
                        { value: "", label: t("form.pipelineDefault") },
                        ...pipelines.map((p) => ({ value: p.id, label: p.name })),
                      ]}
                      searchPlaceholder={t("form.searchPipeline")}
                      emptyMessage={t("form.noPipelines")}
                    />
                  )}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("form.pipelineDescription")}
                </p>
              </div>
            ) : null}

            <div className="border-t border-border pt-4">
              <p className="mb-3 text-sm font-medium text-foreground">
                {t("form.messageTitle")}
              </p>
              {isGroups && hasExternalPick(pickedGroups) ? <ExternalRiskNotice className="mb-3" /> : null}
              <CampaignMessageComposer
                value={message}
                onChange={setMessage}
                disabled={isSubmitting || contentLocked}
                showExitLine={!isGroups}
                mediaSlot={
                  <CampaignMediaPicker
                    kind={message.kind}
                    mediaId={message.mediaId}
                    fileName={message.fileName}
                    accept={MEDIA_ACCEPT[message.kind] ?? "*/*"}
                    disabled={isSubmitting || contentLocked}
                    onChange={(next) =>
                      setMessage({ ...message, mediaId: next.mediaId, fileName: next.fileName })
                    }
                    labels={{
                      upload: t("form.mediaUpload"),
                      uploading: t("form.mediaUploading"),
                      remove: t("form.mediaRemove"),
                      failed: t("form.mediaFailed"),
                    }}
                  />
                }
              />
            </div>

            <div className="border-t border-border pt-4">
              <p className="mb-2 text-sm font-medium text-foreground">
                {t("form.responseMode")}
              </p>
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-border p-1">
                <button
                  type="button"
                  onClick={() => {
                    setResponseMode("agent");
                    setValue("workflowId", null);
                  }}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    responseMode === "agent"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t("form.modeAgent")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResponseMode("workflow");
                    setValue("agentId", null);
                  }}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    responseMode === "workflow"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t("form.modeWorkflow")}
                </button>
              </div>

              {responseMode === "agent" ? (
                <div className="space-y-3">
                  <Controller
                    name="agentId"
                    control={control}
                    render={({ field }) => (
                      <ElevatedCommandSelect
                        label={t("form.agent")}
                        value={field.value || ""}
                        onValueChange={field.onChange}
                        options={agentSelect.options}
                        searchPlaceholder={t("form.searchAgent")}
                        emptyMessage={t("form.noAgents")}
                        onSearch={agentSelect.onSearch}
                        onScrollEnd={agentSelect.onScrollEnd}
                        onOpenChange={agentSelect.onOpenChange}
                        isLoading={agentSelect.isLoading}
                      />
                    )}
                  />
                </div>
              ) : (
                <Controller
                  name="workflowId"
                  control={control}
                  render={({ field }) => (
                    <ElevatedCommandSelect
                      label={t("form.workflow")}
                      value={field.value || ""}
                      onValueChange={field.onChange}
                      options={workflowSelect.options}
                      searchPlaceholder={t("form.searchWorkflow")}
                      emptyMessage={
                        workflowSelect.isLoading
                          ? t("form.loadingWorkflows")
                          : t("form.noWorkflows")
                      }
                      onSearch={workflowSelect.onSearch}
                      onScrollEnd={workflowSelect.onScrollEnd}
                      onOpenChange={workflowSelect.onOpenChange}
                      isLoading={workflowSelect.isLoading}
                    />
                  )}
                />
              )}
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-4 border-t border-border pt-4 sm:grid-cols-2">
              <Controller
                name="enableAnalysis"
                control={control}
                render={({ field }) => (
                  <ElevatedSwitch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    label={t("form.enableAnalysis")}
                    description={t("form.enableAnalysisDescription")}
                    explainer={<ExplainerHint id="settings.conversationAnalysis" />}
                  />
                )}
              />
              <Controller
                name="enableAutoStaging"
                control={control}
                render={({ field }) => (
                  <ElevatedSwitch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    label={t("form.enableAutoStaging")}
                    description={t("form.enableAutoStagingDescription")}
                    explainer={<ExplainerHint id="settings.autoStaging" />}
                  />
                )}
              />
              <Controller
                name="enableAutoMemory"
                control={control}
                render={({ field }) => (
                  <ElevatedSwitch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    label={t("form.enableAutoMemory")}
                    description={t("form.enableAutoMemoryDescription")}
                    explainer={<ExplainerHint id="settings.autoMemory" />}
                  />
                )}
              />
              {mode === "edit" && initialCampaign?.id ? (
                <DealAutomationSetting
                  channel={{ entryType: "unofficial_whatsapp", kind: "campaign", containerId: initialCampaign.id }}
                />
              ) : (
                <DealAutomationDraft value={dealPipelineId} onChange={setDealPipelineId} />
              )}
            </div>

            {enableAnalysis || enableAutoStaging || enableAutoMemory ? (
              <div>
                <Controller
                  name="aiModel"
                  control={control}
                  render={({ field }) => (
                    <AIModelSelector
                      label={t("form.aiModel")}
                      value={field.value || ""}
                      onValueChange={field.onChange}
                      models={aiModels}
                      modelPricing={modelPricing}
                      disabled={aiModels.length === 0}
                    />
                  )}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("form.aiModelDescription")}
                </p>
              </div>
            ) : null}

            <div className="border-t border-border pt-4">
              <CampaignPacingPanel
                minMs={minMs}
                maxMs={maxMs}
                dailyCap={dailyCap}
                instance={isGroups ? null : selectedInstance}
                disabled={isSubmitting}
                onChange={(patch) => {
                  if (patch.minMs !== undefined) setMinMs(patch.minMs);
                  if (patch.maxMs !== undefined) setMaxMs(patch.maxMs);
                  if (patch.dailyCap !== undefined) setDailyCap(patch.dailyCap);
                }}
              />
            </div>

            {!contentLocked && (
              <div className="border-t border-border pt-4">
                <div className="mb-2 flex items-center gap-3">
                  <ElevatedSwitch
                    checked={scheduleEnabled}
                    onCheckedChange={(checked) => {
                      setScheduleEnabled(checked);
                      if (!checked) setValue("scheduledStart", null);
                    }}
                    label={t("form.scheduleToggle")}
                    explainer={<ExplainerHint id="campaigns.scheduledStart" />}
                  />
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  {t("form.scheduleDescription")}
                </p>
                {scheduleEnabled ? (
                  <Controller
                    name="scheduledStart"
                    control={control}
                    render={({ field }) => (
                      <ElevatedInput
                        type="datetime-local"
                        label={t("form.scheduledStart")}
                        value={field.value ? field.value.slice(0, 16) : ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? new Date(e.target.value).toISOString() : null,
                          )
                        }
                        controlSize="sm"
                      />
                    )}
                  />
                ) : null}
              </div>
            )}
          </div>
        </ElevatedContainer>

        <ElevatedContainer className="rounded-lg border border-border bg-card p-5 lg:sticky lg:top-16">
          <h2 className="mb-3 font-display text-lg font-semibold tracking-[0.01em] text-foreground">
            {t("form.previewTitle")}
          </h2>
          <GrainBackground palette="forest" seed={31000} className="rounded-lg border border-border p-4">
            <div className="ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-healthy px-3 py-2 text-sm text-healthy-foreground shadow-sm">
              {previewBody.trim() ? (
                <span className="whitespace-pre-wrap break-words">{previewBody}</span>
              ) : (
                <span className="opacity-60">{t("form.previewEmpty")}</span>
              )}
              {message.footer ? (
                <span className="mt-1 block text-2xs opacity-70">{message.footer}</span>
              ) : null}
            </div>
            {message.kind === "menu" && message.options?.length ? (
              <div className="ml-auto mt-1 max-w-[85%] space-y-1">
                {message.options.map((option, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-center text-xs text-foreground"
                  >
                    {option.title || t("form.optionTitle")}
                  </div>
                ))}
              </div>
            ) : null}
          </GrainBackground>

          <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
            <p>{t("form.previewVariantsHelp", { count: message.bodies.length })}</p>
            {requiredVariables > 0 ? (
              <p>{t("form.variablesDetected", { count: requiredVariables })}</p>
            ) : null}
          </div>
        </ElevatedContainer>
      </div>

      {mode === "create" && isGroups ? (
        <ElevatedContainer className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 space-y-1">
            <h2 className="font-display text-xl font-semibold tracking-[0.01em] text-foreground">
              {t("form.groups.title")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("form.groups.description")}</p>
            <p className="text-xs text-muted-foreground">{t("form.groups.banRisk")}</p>
          </div>

          <div className="space-y-4">
            {prefillSkipped > 0 ? (
              <Notice tone="info">
                <p>{t("form.groups.prefillSkipped", { count: prefillSkipped })}</p>
              </Notice>
            ) : null}

            <CampaignGroupPicker value={pickedGroups} onChange={setPickedGroups} disabled={isSubmitting} />
          </div>
        </ElevatedContainer>
      ) : null}

      {mode === "create" && !isGroups ? (
        <ElevatedContainer className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold tracking-[0.01em] text-foreground">
              {t("form.recipients")}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setRawTargets(await readDelimitedFile(file));
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="secondary"
                title={t("form.downloadExample")}
                icon={<DownloadSimple className="h-4 w-4" weight="bold" />}
                iconVisible
                iconSide="left"
                onClick={handleDownloadCsvExample}
              />
              <Button
                type="button"
                variant="secondary"
                title={t("form.recipientsUpload")}
                icon={<UploadSimple className="h-4 w-4" weight="bold" />}
                iconVisible
                iconSide="left"
                onClick={() => csvInputRef.current?.click()}
              />
            </div>
          </div>

          <TargetListEditor
            value={rawTargets}
            onChange={(raw) => setRawTargets(raw)}
            requiredVariables={requiredVariables}
            isValidNumber={isValidNumber}
            disabled={isSubmitting}
            showUploadButton={false}
            labels={{
              title: t("form.recipientsPaste"),
              placeholder: t("form.recipientsPlaceholder"),
              upload: t("form.recipientsUpload"),
              columnsHelp: t("form.recipientsColumns"),
              skippedTitle: t("form.recipientsSkipped"),
              reasons: {
                invalid: t("form.reasonInvalid"),
                duplicate: t("form.reasonDuplicate"),
                missingVariables: (found, required) => t("form.reasonMissingVariables", { found, required }),
              },
              variablesNeeded: (count) => t("form.recipientsNeedVariables", { count }),
            }}
          />

          {rawTargets.trim() ? (
            <div className="mt-4">
              <CampaignContactList<ParsedTarget>
                rows={parsed.targets}
                rowKey={(target) => target.number}
                number={(target) => target.number}
                name={(target) => target.name}
                valueColumns={recipientVariableColumns}
                searchable={searchableTarget}
                view={recipientView}
                onViewChange={setRecipientView}
                extraCounts={[
                  { label: t("form.recipientsDuplicates"), count: parsed.duplicates },
                  { label: t("form.recipientsInvalid"), count: parsed.invalid + parsed.missingVariables },
                ]}
              />
            </div>
          ) : null}

          {canSeedOutcome ? (
            <div className="mt-4 space-y-3 rounded-[--radius] border border-border bg-card/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <ElevatedSwitch
                  checked={seedOutcome}
                  onCheckedChange={setSeedOutcome}
                  disabled={isSubmitting}
                  label={t("form.seedOutcome")}
                  description={t("form.seedOutcomeDescription")}
                />
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("form.adminOnly")}
                </span>
              </div>

              {seedOutcome ? (
                <div className="space-y-3 border-t border-border pt-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <ElevatedInput
                      type="number"
                      min={0}
                      max={100}
                      controlSize="sm"
                      label={t("form.seedSentPercent")}
                      value={String(sentPercent)}
                      onChange={(e) => setSentPercent(Number(e.target.value))}
                      disabled={isSubmitting}
                    />
                    <ElevatedInput
                      type="number"
                      min={0}
                      max={100}
                      controlSize="sm"
                      label={t("form.seedFailedPercent")}
                      value={String(failedPercent)}
                      onChange={(e) => setFailedPercent(Number(e.target.value))}
                      disabled={isSubmitting}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("form.seedOutcomeSummary", seedCounts)}
                  </p>
                  {seedOverflow ? (
                    <FieldError message={t("form.seedOutcomeOverflow")} />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </ElevatedContainer>
      ) : null}

      {estimateRequest ? <CampaignSendReview isGroups={isGroups} estimate={estimate} picked={pickedGroups} /> : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          title={t("actions.cancel")}
          onClick={() => router.push("/dashboard/unofficial-whatsapp-campaigns")}
        />
        <Button
          type="submit"
          variant="primary"
          title={mode === "edit" ? t("form.save") : t("form.create")}
          disabled={
            isSubmitting || numberUnusable || !bodiesReady || exitPending || seedOverflow
          }
        />
      </div>
    </form>
  );
}
