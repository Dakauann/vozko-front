"use client";

import { Controller } from "react-hook-form";
import { useTranslations } from "next-intl";

import { CampaignAudienceStep } from "@/components/campaign-audience/CampaignAudienceStep";
import { CampaignMediaPicker, MEDIA_ACCEPT } from "@/components/campaigns/CampaignMediaPicker";
import { SelectionSendNote } from "@/components/campaigns/SelectionSendNote";
import { DealAutomationDraft, DealAutomationSetting } from "@/components/channels/deal-automation-setting";
import { AIModelSelector } from "@/components/elevated-design/ai-model-selector";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import GrainBackground from "@/components/elevated-design/grain-background";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { Notice } from "@/components/ui/notice";
import { CampaignMessageComposer } from "@/components/unofficial-whatsapp/campaign-message-composer";
import { CampaignPacingPanel } from "@/components/unofficial-whatsapp/campaign-pacing-panel";
import { InstanceIssueLine } from "@/components/unofficial-whatsapp/instance-select";
import { ExternalRiskNotice } from "@/components/unofficial-whatsapp-groups/kit/notices";
import type { ModelPricingInfo } from "@/lib/agents/types";
import type { LeadsPickDraft } from "@/lib/campaign-audience/draft";
import type { UnofficialWhatsAppCampaignAudience } from "@/lib/unofficial-whatsapp-campaigns/types";
import { cn } from "@/lib/utils";

import { CampaignGroupPicker } from "./CampaignGroupPicker";
import { hasExternalPick } from "./group-picks";
import type { UnofficialCampaignForm } from "./use-unofficial-campaign-form";

export const FieldError = ({ message }: { message?: string }) =>
  message ? <p className="mt-1 text-xs font-semibold text-destructive-ink">{message}</p> : null;

export function BasicFields({ form }: { form: UnofficialCampaignForm }) {
  const t = useTranslations("unofficialWhatsappCampaigns");
  const {
    form: {
      control,
      register,
      formState: { errors },
    },
    mode,
    contentLocked,
    audience,
    setAudience,
    isGroups,
    groupsAudienceRef,
    instanceSelect,
    issue,
    pipelines,
  } = form;
  return (
    <>
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
          <p className="text-xs text-muted-foreground">{isGroups ? t("form.audience.groupsDescription") : t("form.audience.leadsDescription")}</p>
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
                options={[{ value: "", label: t("form.pipelineDefault") }, ...pipelines.map((p) => ({ value: p.id, label: p.name }))]}
                searchPlaceholder={t("form.searchPipeline")}
                emptyMessage={t("form.noPipelines")}
              />
            )}
          />
          <p className="mt-1 text-xs text-muted-foreground">{t("form.pipelineDescription")}</p>
        </div>
      ) : null}
    </>
  );
}

export function MessageFields({ form, disabled, divided = true }: { form: UnofficialCampaignForm; disabled: boolean; divided?: boolean }) {
  const t = useTranslations("unofficialWhatsappCampaigns");
  const { message, setMessage, isGroups, pickedGroups, contentLocked } = form;
  return (
    <div className={cn(divided && "border-t border-border pt-4")}>
      <p className="mb-3 text-sm font-medium text-foreground">{t("form.messageTitle")}</p>
      {isGroups && hasExternalPick(pickedGroups) ? <ExternalRiskNotice className="mb-3" /> : null}
      <CampaignMessageComposer
        value={message}
        onChange={setMessage}
        disabled={disabled || contentLocked}
        showExitLine={!isGroups}
        mediaSlot={
          <CampaignMediaPicker
            kind={message.kind}
            mediaId={message.mediaId}
            fileName={message.fileName}
            accept={MEDIA_ACCEPT[message.kind] ?? "*/*"}
            disabled={disabled || contentLocked}
            onChange={(next) => setMessage({ ...message, mediaId: next.mediaId, fileName: next.fileName })}
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
  );
}

export function ResponseFields({
  form,
  aiModels,
  modelPricing,
  disabled,
  campaignId,
  showSchedule,
}: {
  form: UnofficialCampaignForm;
  aiModels: string[];
  modelPricing: ModelPricingInfo[];
  disabled: boolean;
  campaignId?: string;
  showSchedule: boolean;
}) {
  const t = useTranslations("unofficialWhatsappCampaigns");
  const {
    form: { control, setValue },
    responseMode,
    setResponseMode,
    agentSelect,
    workflowSelect,
    enableAnalysis,
    enableAutoStaging,
    enableAutoMemory,
    pacing,
    setPacing,
    isGroups,
    selectedInstance,
    scheduleEnabled,
    setScheduleEnabled,
    contentLocked,
    dealPipelineId,
    setDealPipelineId,
  } = form;
  return (
    <>
      <div className="border-t border-border pt-4">
        <p className="mb-2 text-sm font-medium text-foreground">{t("form.responseMode")}</p>
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-border p-1">
          <button
            type="button"
            onClick={() => setResponseMode("agent")}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              responseMode === "agent" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("form.modeAgent")}
          </button>
          <button
            type="button"
            onClick={() => setResponseMode("workflow")}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              responseMode === "workflow" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground",
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
                emptyMessage={workflowSelect.isLoading ? t("form.loadingWorkflows") : t("form.noWorkflows")}
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
        {campaignId ? (
          <DealAutomationSetting channel={{ entryType: "unofficial_whatsapp", kind: "campaign", containerId: campaignId }} />
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
          <p className="mt-2 text-xs text-muted-foreground">{t("form.aiModelDescription")}</p>
        </div>
      ) : null}

      <div className="border-t border-border pt-4">
        <CampaignPacingPanel
          minMs={pacing.minMs}
          maxMs={pacing.maxMs}
          dailyCap={pacing.dailyCap}
          instance={isGroups ? null : selectedInstance}
          disabled={disabled}
          onChange={(patch) => {
            if (patch.minMs !== undefined) setPacing({ minMs: patch.minMs });
            if (patch.maxMs !== undefined) setPacing({ maxMs: patch.maxMs });
            if (patch.dailyCap !== undefined) setPacing({ dailyCap: patch.dailyCap });
          }}
        />
      </div>

      {showSchedule && !contentLocked ? (
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
          <p className="mb-3 text-xs text-muted-foreground">{t("form.scheduleDescription")}</p>
          {scheduleEnabled ? (
            <Controller
              name="scheduledStart"
              control={control}
              render={({ field }) => (
                <ElevatedInput
                  type="datetime-local"
                  label={t("form.scheduledStart")}
                  value={field.value ? field.value.slice(0, 16) : ""}
                  onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
                  controlSize="sm"
                />
              )}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function MessagePreview({ form }: { form: UnofficialCampaignForm }) {
  const t = useTranslations("unofficialWhatsappCampaigns");
  const { message, requiredVariables } = form;
  const previewBody = message.bodies[0] ?? "";
  return (
    <ElevatedContainer className="rounded-lg border border-border bg-card p-5 lg:sticky lg:top-16">
      <h2 className="mb-3 font-display text-lg font-semibold tracking-[0.01em] text-foreground">{t("form.previewTitle")}</h2>
      <GrainBackground palette="forest" seed={31000} className="rounded-lg border border-border p-4">
        <div className="ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-healthy px-3 py-2 text-sm text-healthy-foreground shadow-sm">
          {previewBody.trim() ? <span className="whitespace-pre-wrap break-words">{previewBody}</span> : <span className="opacity-60">{t("form.previewEmpty")}</span>}
          {message.footer ? <span className="mt-1 block text-2xs opacity-70">{message.footer}</span> : null}
        </div>
        {message.kind === "menu" && message.options?.length ? (
          <div className="ml-auto mt-1 max-w-[85%] space-y-1">
            {message.options.map((option, index) => (
              <div key={index} className="rounded-lg border border-border bg-background px-3 py-1.5 text-center text-xs text-foreground">
                {option.title || t("form.optionTitle")}
              </div>
            ))}
          </div>
        ) : null}
      </GrainBackground>

      <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
        <p>{t("form.previewVariantsHelp", { count: message.bodies.length })}</p>
        {requiredVariables > 0 ? <p>{t("form.variablesDetected", { count: requiredVariables })}</p> : null}
      </div>
    </ElevatedContainer>
  );
}

export function GroupsAudience({ form, disabled }: { form: UnofficialCampaignForm; disabled: boolean }) {
  const t = useTranslations("unofficialWhatsappCampaigns");
  const { prefillSkipped, pickedGroups, setPickedGroups } = form;
  return (
    <ElevatedContainer className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 space-y-1">
        <h2 className="font-display text-xl font-semibold tracking-[0.01em] text-foreground">{t("form.groups.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("form.groups.description")}</p>
        <p className="text-xs text-muted-foreground">{t("form.groups.banRisk")}</p>
      </div>

      <div className="space-y-4">
        {prefillSkipped > 0 ? (
          <Notice tone="info">
            <p>{t("form.groups.prefillSkipped", { count: prefillSkipped })}</p>
          </Notice>
        ) : null}

        <CampaignGroupPicker value={pickedGroups} onChange={setPickedGroups} disabled={disabled} />
      </div>
    </ElevatedContainer>
  );
}

export function LeadsAudience({ form, disabled, onEditMap }: { form: UnofficialCampaignForm; disabled: boolean; onEditMap?: (pick: LeadsPickDraft) => void }) {
  const t = useTranslations("unofficialWhatsappCampaigns");
  const { leadsAudience, message, canSeedOutcome, seedOutcome, setSeedOutcome, seedCounts, seedOverflow } = form;
  return (
    <ElevatedContainer className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 font-display text-xl font-semibold tracking-[0.01em] text-foreground">{t("form.audienceTitle")}</h2>

      <CampaignAudienceStep audience={leadsAudience} message={message.bodies[0] ?? ""} readOnly={disabled} onEditMap={onEditMap} />

      {canSeedOutcome ? (
        <div className="mt-4 space-y-3 rounded-[--radius] border border-border bg-card/40 p-3">
          <div className="flex items-start justify-between gap-2">
            <ElevatedSwitch
              checked={seedOutcome.on}
              onCheckedChange={(on) => setSeedOutcome({ ...seedOutcome, on })}
              disabled={disabled}
              label={t("form.seedOutcome")}
              description={t("form.seedOutcomeDescription")}
            />
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{t("form.adminOnly")}</span>
          </div>

          {seedOutcome.on ? (
            <div className="space-y-3 border-t border-border pt-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ElevatedInput
                  type="number"
                  min={0}
                  max={100}
                  controlSize="sm"
                  label={t("form.seedSentPercent")}
                  value={String(seedOutcome.sentPercent)}
                  onChange={(e) => setSeedOutcome({ ...seedOutcome, sentPercent: Number(e.target.value) })}
                  disabled={disabled}
                />
                <ElevatedInput
                  type="number"
                  min={0}
                  max={100}
                  controlSize="sm"
                  label={t("form.seedFailedPercent")}
                  value={String(seedOutcome.failedPercent)}
                  onChange={(e) => setSeedOutcome({ ...seedOutcome, failedPercent: Number(e.target.value) })}
                  disabled={disabled}
                />
              </div>
              <p className="text-xs text-muted-foreground">{t("form.seedOutcomeSummary", seedCounts)}</p>
              {seedOverflow ? <FieldError message={t("form.seedOutcomeOverflow")} /> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </ElevatedContainer>
  );
}
