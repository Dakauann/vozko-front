"use client";

import { Controller, useForm } from "react-hook-form";
import { DownloadSimple, UploadSimple, Warning } from "@/components/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AIModelSelector } from "@/components/elevated-design/ai-model-selector";
import Button from "@/components/elevated-design/button";
import { CampaignMediaPicker, MEDIA_ACCEPT } from "@/components/campaigns/CampaignMediaPicker";
import {
  CampaignMessageComposer,
  parameterCount,
  variantsAgree,
} from "@/components/unofficial-whatsapp/campaign-message-composer";
import { CampaignPacingPanel } from "@/components/unofficial-whatsapp/campaign-pacing-panel";
import {
  ElevatedCommandSelect,
  type ElevatedCommandOption,
} from "@/components/elevated-design/elevated-command-select";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import GrainBackground from "@/components/elevated-design/grain-background";
import {
  TargetListEditor,
  parseTargetList,
  type ParsedTargetList,
} from "@/components/campaigns/TargetListEditor";
import type { AgentListItem, ModelPricingInfo } from "@/lib/agents/types";
import type { UnofficialWhatsAppInstance } from "@/lib/unofficial-whatsapp/types";
import type {
  UnofficialWhatsAppCampaign,
  UnofficialWhatsAppMessageSpec,
} from "@/lib/unofficial-whatsapp-campaigns/types";
import type { Workflow } from "@/lib/workflows/types";
import { instanceIssue } from "@/lib/unofficial-whatsapp/types";
import { cn } from "@/lib/utils";
import {
  createUnofficialCampaignAction,
  updateUnofficialCampaignAction,
} from "@/app/actions/unofficial-whatsapp-campaigns";
import { listAgentsAction } from "@/app/actions/agents";
import { listInstancesAction } from "@/app/actions/unofficial-whatsapp";
import { listPipelinesAction } from "@/app/actions/crm-board";
import { listWorkflowsAction } from "@/app/actions/workflows";
import { usePaginatedSelect } from "@/hooks/use-paginated-select";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

/**
 * Create / edit an unofficial WhatsApp campaign.
 *
 * Structurally the same form as the Cloud API campaign's, section for section
 * and component for component, because an operator who runs both products
 * should fill in the same fields in the same order. The template picker is
 * replaced by the message composer and the pacing panel — the two places where
 * this transport genuinely differs — and everything else is the official form's
 * own vocabulary: ElevatedCommandSelect over a paginated fetch, the
 * agent/workflow segmented toggle, the switch grid, the AI model selector, the
 * schedule toggle, and a CSV importer beside a live preview.
 */

type FormValues = {
  name: string;
  instanceId: string;
  pipelineId: string;
  agentId: string | null;
  workflowId: string | null;
  enableAgentResponses: boolean;
  enableWorkflow: boolean;
  preferAudio: boolean;
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

/** Not Brazil-pinned: this channel reaches numbers anywhere. */
const isValidNumber = (digits: string) => digits.length >= 10 && digits.length <= 15;

const FieldError = ({ message }: { message?: string }) =>
  message ? (
    <p className="mt-1 text-xs font-semibold text-destructive-ink">{message}</p>
  ) : null;

export default function CreateUnofficialCampaignForm({
  mode = "create",
  initialCampaign,
  aiModels = [],
  modelPricing = [],
}: {
  mode?: "create" | "edit";
  initialCampaign?: UnofficialWhatsAppCampaign | null;
  aiModels?: string[];
  modelPricing?: ModelPricingInfo[];
}) {
  const t = useTranslations("unofficialWhatsappCampaigns");
  const router = useRouter();
  const { toast } = useToast();

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
      preferAudio: initialCampaign?.preferAudio ?? false,
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
  const [rawTargets, setRawTargets] = useState("");
  const [responseMode, setResponseMode] = useState<"agent" | "workflow">(
    initialCampaign?.enableWorkflow ? "workflow" : "agent",
  );
  const [scheduleEnabled, setScheduleEnabled] = useState(
    Boolean(initialCampaign?.scheduledStart),
  );
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [minMs, setMinMs] = useState(initialCampaign?.sendDelayMinMs ?? 3000);
  const [maxMs, setMaxMs] = useState(initialCampaign?.sendDelayMaxMs ?? 12000);
  const [dailyCap, setDailyCap] = useState(initialCampaign?.dailyCap ?? 0);

  const csvInputRef = useRef<HTMLInputElement>(null);

  const instanceId = watch("instanceId");
  const enableAnalysis = watch("enableAnalysis");
  const enableAutoStaging = watch("enableAutoStaging");
  const enableAutoMemory = watch("enableAutoMemory");

  // ---------------------------------------------------------------- selects

  const mapInstanceOption = useCallback(
    (instance: UnofficialWhatsAppInstance): ElevatedCommandOption => ({
      value: instance.id,
      // The session state rides in the label: which number can actually send is
      // the fact that decides whether Start will work, and burying it costs the
      // operator a failed campaign to discover.
      label: instance.sessionLive
        ? instance.displayName
        : `${instance.displayName} — ${t("form.numberOffline")}`,
    }),
    [t],
  );

  const instanceSelect = usePaginatedSelect<UnofficialWhatsAppInstance>({
    fetchFn: useCallback(async (page: number, search: string) => {
      const result = await listInstancesAction(page, 20, search || undefined);
      return { items: result.instances ?? [], totalPages: result.meta.totalPages };
    }, []),
    mapOption: mapInstanceOption,
  });

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

  const selectedInstance = useMemo(
    () => instanceSelect.items.find((i) => i.id === instanceId) ?? null,
    [instanceSelect.items, instanceId],
  );

  // ---------------------------------------------------------------- targets

  const requiredVariables = parameterCount(message);
  const variantsOk = variantsAgree(message);
  const bodiesFilled =
    message.kind === "text" || message.kind === "menu"
      ? message.bodies.every((b) => b.trim().length > 0)
      : true;

  const parsed = useMemo(
    () => (rawTargets ? parseTargetList(rawTargets, requiredVariables, isValidNumber) : EMPTY_PARSE),
    [rawTargets, requiredVariables],
  );

  const issue = selectedInstance ? instanceIssue(selectedInstance) : null;
  // A banned or half-provisioned number can only ever fail, so the form refuses
  // it outright rather than letting the operator find out at Start.
  const numberUnusable = issue === "banned" || issue === "provision-failed";

  const handleDownloadCsvExample = () => {
    // The example carries exactly the columns the parser reads, in order, so an
    // operator can fill it in without guessing the shape.
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

  // ---------------------------------------------------------------- submit

  const onSubmit = handleSubmit(async (values) => {
    if (!variantsOk || !bodiesFilled) {
      toast({ title: t("form.saveFailed"), description: t("form.variantsMismatch"), variant: "destructive" });
      return;
    }
    if (mode === "create" && parsed.targets.length === 0) {
      toast({ title: t("form.saveFailed"), description: t("form.noTargets"), variant: "destructive" });
      return;
    }

    const payload = {
      name: values.name.trim(),
      instanceId: values.instanceId,
      message,
      pipelineId: values.pipelineId || null,
      agentId: responseMode === "agent" ? values.agentId : null,
      workflowId: responseMode === "workflow" ? values.workflowId : null,
      enableAgentResponses: responseMode === "agent" && Boolean(values.agentId),
      enableWorkflow: responseMode === "workflow" && Boolean(values.workflowId),
      preferAudio: responseMode === "agent" && values.preferAudio,
      enableAnalysis: values.enableAnalysis,
      enableAutoStaging: values.enableAutoStaging,
      enableAutoMemory: values.enableAutoMemory,
      aiModel: values.aiModel || undefined,
      scheduledStart: scheduleEnabled ? values.scheduledStart : null,
      sendDelayMinMs: minMs,
      sendDelayMaxMs: maxMs,
      dailyCap,
      targets: parsed.targets.map((target) => ({
        number: target.number,
        name: target.name,
        variables: target.variables,
      })),
    };

    const result =
      mode === "edit" && initialCampaign
        ? await updateUnofficialCampaignAction(initialCampaign.id, payload)
        : await createUnofficialCampaignAction(payload);

    if (result.error) {
      toast({ title: t("form.saveFailed"), description: result.error, variant: "destructive" });
      return;
    }
    router.push(`/dashboard/unofficial-whatsapp-campaigns/${result.campaign?.id ?? ""}`);
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

            <div>
              <Controller
                name="instanceId"
                control={control}
                rules={{ required: t("form.numberRequired") }}
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
                  />
                )}
              />
              <FieldError message={errors.instanceId?.message} />
              <p className="mt-1 text-xs text-muted-foreground">
                {t("form.numberDescription")}
              </p>
              {/* Named, not merely disabled: reconnect, wait and
                  nothing-can-be-done are different remedies. */}
              {issue ? (
                <p
                  className={cn(
                    "mt-1.5 flex items-center gap-1.5 text-xs font-semibold",
                    numberUnusable ? "text-destructive-ink" : "text-warning-ink",
                  )}
                >
                  <Warning className="h-3.5 w-3.5" weight="fill" />
                  {t(`numberIssue.${issue}`)}
                </p>
              ) : null}
            </div>

            {pipelines.length > 0 ? (
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

            {/* The message composer stands where the template picker stands on
                the official form: this channel has no templates. */}
            <div className="border-t border-border pt-4">
              <p className="mb-3 text-sm font-medium text-foreground">
                {t("form.messageTitle")}
              </p>
              <CampaignMessageComposer
                value={message}
                onChange={setMessage}
                disabled={isSubmitting}
                mediaSlot={
                  <CampaignMediaPicker
                    mediaId={message.mediaId}
                    fileName={message.fileName}
                    accept={MEDIA_ACCEPT[message.kind] ?? "*/*"}
                    disabled={isSubmitting}
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
                    setValue("preferAudio", false);
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
                  <Controller
                    name="preferAudio"
                    control={control}
                    render={({ field }) => (
                      <ElevatedSwitch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        label={t("form.preferAudio")}
                        description={t("form.preferAudioDescription")}
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
                  />
                )}
              />
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
                instance={selectedInstance}
                disabled={isSubmitting}
                onChange={(patch) => {
                  if (patch.minMs !== undefined) setMinMs(patch.minMs);
                  if (patch.maxMs !== undefined) setMaxMs(patch.maxMs);
                  if (patch.dailyCap !== undefined) setDailyCap(patch.dailyCap);
                }}
              />
            </div>

            <div className="border-t border-border pt-4">
              <div className="mb-2 flex items-center gap-3">
                <ElevatedSwitch
                  checked={scheduleEnabled}
                  onCheckedChange={(checked) => {
                    setScheduleEnabled(checked);
                    if (!checked) setValue("scheduledStart", null);
                  }}
                  label={t("form.scheduleToggle")}
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
          </div>
        </ElevatedContainer>

        {/* Preview, in the same slot the official form puts the template
            preview: the operator reads what the customer will receive without
            leaving the page. */}
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

      {mode === "create" ? (
        <ElevatedContainer className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold tracking-[0.01em] text-foreground">
              {t("form.recipients")}
            </h2>
            <div className="flex items-center gap-2">
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setRawTargets(await file.text());
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
              summary: (c) =>
                t("form.recipientsSummary", {
                  valid: c.valid,
                  duplicates: c.duplicates,
                  invalid: c.invalid + c.missingVariables,
                }),
              skippedTitle: t("form.recipientsSkipped"),
              reasons: {
                invalid: t("form.reasonInvalid"),
                duplicate: t("form.reasonDuplicate"),
                missingVariables: t("form.reasonMissingVariables"),
              },
              variablesNeeded: (count) => t("form.recipientsNeedVariables", { count }),
            }}
          />
        </ElevatedContainer>
      ) : null}

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
          disabled={isSubmitting || numberUnusable || !variantsOk || !bodiesFilled}
        />
      </div>
    </form>
  );
}
