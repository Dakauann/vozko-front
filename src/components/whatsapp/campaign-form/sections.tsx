"use client";

import { useTranslations } from "next-intl";
import { Controller } from "react-hook-form";

import { DealAutomationDraft, DealAutomationSetting } from "@/components/channels/deal-automation-setting";
import { SelectionSendNote } from "@/components/campaigns/SelectionSendNote";
import { AIModelSelector } from "@/components/elevated-design/ai-model-selector";
import Button from "@/components/elevated-design/button";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import GrainBackground from "@/components/elevated-design/grain-background";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { CalendarCheck, ImageSquare } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import TemplateEditModal from "@/components/whatsapp/TemplateEditModal";
import { ButtonDestinations } from "@/components/whatsapp/exit/ButtonDestinations";
import { cn } from "@/lib/utils";

import type { WhatsAppCampaignFormState } from "./use-campaign-form";

type FormProps = { f: WhatsAppCampaignFormState };

const FieldError = ({ message }: { message?: string }) => {
  if (!message) return null;
  return <p className="mt-1 text-xs font-semibold text-destructive-ink">{message}</p>;
};

export function CampaignNameField({ f }: FormProps) {
  const t = useTranslations("whatsappCampaignsPage.form");
  const {
    register,
    formState: { errors },
  } = f.form;
  return (
    <div>
      <ElevatedInput label={t("basicInfo.campaignName")} {...register("name")} controlSize="default" placeholder={t("basicInfo.campaignNamePlaceholder")} />
      <FieldError message={errors.name?.message} />
    </div>
  );
}

export function BusinessPhoneField({ f }: FormProps) {
  const t = useTranslations("whatsappCampaignsPage.form");
  const {
    control,
    setValue,
    formState: { errors },
  } = f.form;
  return (
    <div data-tour="wc-phone-template">
      <Controller
        name="businessPhoneId"
        control={control}
        render={({ field }) => (
          <ElevatedCommandSelect
            label={t("basicInfo.businessPhone")}
            value={field.value}
            onValueChange={(val) => {
              field.onChange(val);
              setValue("templateId", "", { shouldDirty: true });
            }}
            disabled={f.contentLocked}
            options={f.businessPhoneOptions}
            searchPlaceholder={t("basicInfo.searchBusinessPhone")}
            emptyMessage={t("basicInfo.noBusinessPhones")}
            onSearch={f.businessPhoneSelect.onSearch}
            onScrollEnd={f.businessPhoneSelect.onScrollEnd}
            onOpenChange={f.businessPhoneSelect.onOpenChange}
            isLoading={f.businessPhoneSelect.isLoading}
          />
        )}
      />
      <FieldError message={errors.businessPhoneId?.message} />
      {f.contentLocked ? <SelectionSendNote reason="templateLocked" className="mt-2" /> : <p className="mt-1 text-xs text-muted-foreground">{t("basicInfo.businessPhoneDescription")}</p>}
    </div>
  );
}

export function PipelineField({ f }: FormProps) {
  const t = useTranslations("whatsappCampaignsPage.form");
  return (
    <div>
      <ElevatedCommandSelect
        label={t("basicInfo.pipeline")}
        options={[{ value: "", label: t("basicInfo.pipelineDefault") }, ...f.pipelineOptions.map((p) => ({ value: p.id, label: p.name }))]}
        value={f.selectedPipelineId}
        onValueChange={f.setSelectedPipelineId}
        searchPlaceholder={t("basicInfo.searchPipeline")}
        emptyMessage={t("basicInfo.noPipelines")}
      />
      <p className="mt-1 text-xs text-muted-foreground">{t("basicInfo.pipelineDescription")}</p>
    </div>
  );
}

export function TemplateField({ f }: FormProps) {
  const t = useTranslations("whatsappCampaignsPage.form");
  const {
    control,
    formState: { errors },
  } = f.form;
  const { selectedTemplate } = f;
  return (
    <div>
      <Controller
        name="templateId"
        control={control}
        render={({ field }) => (
          <ElevatedCommandSelect
            label={t("basicInfo.template")}
            value={field.value}
            onValueChange={field.onChange}
            disabled={f.contentLocked || !f.selectedBusinessPhoneId}
            options={f.templateOptions}
            searchPlaceholder={t("basicInfo.searchTemplate")}
            emptyMessage={!f.selectedBusinessPhoneId ? t("basicInfo.selectPhoneFirst") : f.templateSelect.isLoading ? t("basicInfo.loadingTemplates") : t("basicInfo.noTemplates")}
            onSearch={f.templateSelect.onSearch}
            onScrollEnd={f.templateSelect.onScrollEnd}
            onOpenChange={f.templateSelect.onOpenChange}
            isLoading={f.templateSelect.isLoading}
          />
        )}
      />
      <FieldError message={errors.templateId?.message} />

      {f.selectedTemplateMissingMedia && f.isAdmin && selectedTemplate && (
        <Notice tone="warning" title={t("media.missingTitle")} icon={<ImageSquare weight="fill" />} className="mt-3">
          <p>{t("media.missingDescription")}</p>
          <Button
            type="button"
            variant="secondary"
            title={t("media.configureButton")}
            icon={<ImageSquare className="h-4 w-4" weight="bold" />}
            iconVisible
            iconSide="left"
            onClick={() => f.setMediaModalOpen(true)}
          />
        </Notice>
      )}

      {selectedTemplate && f.templateVariables.length > 0 && !f.contentLocked && (
        <div className="mt-3 rounded-lg border border-border bg-muted p-4" data-tour="wc-template-variables">
          <h4 className="mb-2 text-sm font-semibold text-foreground">{t("basicInfo.templateVariables")}</h4>
          <p className="mb-3 text-xs text-muted-foreground">{t("basicInfo.templateVariablesDescription")}</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {f.templateVariables.map((varPlaceholder, idx) => (
              <span key={idx} className="inline-flex items-center rounded-md bg-healthy px-2 py-1 text-xs font-medium text-healthy-foreground">
                {varPlaceholder}
              </span>
            ))}
          </div>

          <p className="border-t border-border pt-3 text-xs text-muted-foreground">{t("basicInfo.templatePreviewHint")}</p>
        </div>
      )}
    </div>
  );
}

export function ResponseModeField({ f }: FormProps) {
  const t = useTranslations("whatsappCampaignsPage.form");
  const {
    control,
    formState: { errors },
  } = f.form;
  return (
    <div data-tour="wc-response-mode">
      <p className="mb-2 text-sm font-medium text-foreground">{t("basicInfo.responseMode")}</p>
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-border p-1">
        <button
          type="button"
          onClick={() => f.chooseResponseMode("agent")}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            f.responseMode === "agent" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t("basicInfo.modeAgent")}
        </button>
        <button
          type="button"
          onClick={() => f.chooseResponseMode("workflow")}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            f.responseMode === "workflow" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t("basicInfo.modeWorkflow")}
        </button>
      </div>

      {f.responseMode === "agent" && (
        <div className="space-y-3" data-tour="wc-agent-settings">
          <Controller
            name="agentId"
            control={control}
            render={({ field }) => (
              <ElevatedCommandSelect
                label={t("basicInfo.agent")}
                value={field.value || ""}
                onValueChange={field.onChange}
                options={f.agentOptions}
                searchPlaceholder={t("basicInfo.searchAgent")}
                emptyMessage={t("basicInfo.noAgents")}
                onSearch={f.agentSelect.onSearch}
                onScrollEnd={f.agentSelect.onScrollEnd}
                onOpenChange={f.agentSelect.onOpenChange}
                isLoading={f.agentSelect.isLoading}
              />
            )}
          />
          <FieldError message={errors.agentId?.message} />
        </div>
      )}

      {f.responseMode === "workflow" && (
        <div className="space-y-3">
          <Controller
            name="workflowId"
            control={control}
            render={({ field }) => (
              <ElevatedCommandSelect
                label={t("basicInfo.workflow")}
                value={field.value || ""}
                onValueChange={field.onChange}
                options={f.workflowOptions}
                searchPlaceholder={t("basicInfo.searchWorkflow")}
                emptyMessage={f.workflowSelect.isLoading ? t("basicInfo.loadingWorkflows") : t("basicInfo.noWorkflows")}
                onSearch={f.workflowSelect.onSearch}
                onScrollEnd={f.workflowSelect.onScrollEnd}
                onOpenChange={f.workflowSelect.onOpenChange}
                isLoading={f.workflowSelect.isLoading}
              />
            )}
          />
        </div>
      )}
    </div>
  );
}

export function CampaignToolsFields({ f }: FormProps) {
  const t = useTranslations("whatsappCampaignsPage.form");
  const { control } = f.form;
  const { campaignToolsAvailable, initialCampaign } = f;
  return (
    <>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2" data-tour="wc-analysis">
        {campaignToolsAvailable && (
          <div>
            <Controller
              name="enableAnalysis"
              control={control}
              render={({ field }) => (
                <ElevatedSwitch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  label={t("basicInfo.enableAnalysis")}
                  description={t("basicInfo.enableAnalysisDescription")}
                  explainer={<ExplainerHint id="settings.conversationAnalysis" />}
                />
              )}
            />
          </div>
        )}

        {campaignToolsAvailable && (
          <div>
            <Controller
              name="enableAutoStaging"
              control={control}
              render={({ field }) => (
                <ElevatedSwitch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  label={t("basicInfo.enableAutoStaging")}
                  description={t("basicInfo.enableAutoTaggingDescription")}
                  explainer={<ExplainerHint id="settings.autoStaging" />}
                />
              )}
            />
          </div>
        )}

        {campaignToolsAvailable && (
          <div>
            <Controller
              name="enableAutoMemory"
              control={control}
              render={({ field }) => (
                <ElevatedSwitch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  label={t("basicInfo.enableAutoMemory")}
                  description={t("basicInfo.enableAutoMemoryDescription")}
                  explainer={<ExplainerHint id="settings.autoMemory" />}
                />
              )}
            />
          </div>
        )}

        {campaignToolsAvailable &&
          (f.mode === "edit" && initialCampaign?.id ? (
            <DealAutomationSetting channel={{ entryType: "whatsapp", kind: "campaign", containerId: initialCampaign.id }} />
          ) : (
            <DealAutomationDraft value={f.dealPipelineId} onChange={f.setDealPipelineId} />
          ))}

        <div data-tour="wc-show-template-in-crm">
          <Controller
            name="showTemplateInCrm"
            control={control}
            render={({ field }) => (
              <ElevatedSwitch
                checked={field.value}
                onCheckedChange={field.onChange}
                label={t("basicInfo.showTemplateInCrm")}
                description={t("basicInfo.showTemplateInCrmDescription")}
                explainer={<ExplainerHint id="campaigns.templateInCrm" />}
              />
            )}
          />
        </div>
      </div>

      {campaignToolsAvailable && (f.enableAnalysis || f.enableAutoStaging || f.enableAutoMemory) && (
        <div>
          <Controller
            name="aiModel"
            control={control}
            render={({ field }) => (
              <AIModelSelector
                label={t("aiModel")}
                value={field.value || ""}
                onValueChange={field.onChange}
                models={f.aiModels}
                modelPricing={f.modelPricing}
                disabled={f.loadingModels || f.aiModels.length === 0}
              />
            )}
          />
          <p className="mt-2 text-xs text-muted-foreground">{t("aiModelDescription")}</p>
        </div>
      )}
    </>
  );
}

function toLocalDatetime(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ScheduleField({ f }: FormProps) {
  const t = useTranslations("whatsappCampaignsPage.form");
  const { control, setValue } = f.form;
  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <ElevatedSwitch
          onCheckedChange={(checked) => {
            f.setScheduleEnabled(checked);
            if (!checked) {
              setValue("scheduledStart", null);
            }
          }}
          label={t("basicInfo.scheduleToggle")}
          explainer={<ExplainerHint id="campaigns.scheduledStart" />}
        />
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{t("basicInfo.scheduleDescription")}</p>

      {f.scheduleEnabled && (
        <div>
          <Controller
            name="scheduledStart"
            control={control}
            render={({ field }) => {
              const now = new Date();
              const minDate = new Date(now.getTime() + 5 * 60 * 1000);
              const maxDate = new Date(now);
              maxDate.setFullYear(maxDate.getFullYear() + 1);

              return (
                <ElevatedInput
                  icon={<CalendarCheck className="h-5 w-5" weight="fill" />}
                  label={t("basicInfo.scheduledStartLabel")}
                  type="datetime-local"
                  value={toLocalDatetime(field.value)}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      field.onChange(null);
                      return;
                    }
                    const date = new Date(val);
                    field.onChange(date.toISOString());
                  }}
                  min={toLocalDatetime(minDate.toISOString())}
                  max={toLocalDatetime(maxDate.toISOString())}
                  controlSize="default"
                />
              );
            }}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">{t("basicInfo.scheduleHint")}</p>
        </div>
      )}
    </div>
  );
}

export function TemplatePreviewCard({ f }: FormProps) {
  const t = useTranslations("whatsappCampaignsPage.form");
  const { selectedTemplate, previewEntry, renderTemplateText, campaignExit, contentLocked, pickPreviewEntry, templateInfoConfirmed, confirmTemplate, mode } = f;
  const header = selectedTemplate?.components.find((c) => c.type === "HEADER");
  const body = selectedTemplate?.components.find((c) => c.type === "BODY");
  const footer = selectedTemplate?.components.find((c) => c.type === "FOOTER");
  const buttons = selectedTemplate?.components.find((c) => c.type === "BUTTONS")?.buttons;
  return (
    <ElevatedContainer className="rounded-lg border border-border bg-card p-5 lg:sticky lg:top-16" data-tour="wc-preview">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{t("preview.title")}</h3>
        <Button type="button" variant="secondary" title={t("preview.swapContact")} onClick={pickPreviewEntry} />
      </div>

      {!selectedTemplate ? (
        <p className="text-sm text-muted-foreground">{t("preview.selectTemplate")}</p>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
            <p>
              <strong>{t("preview.testContact")}</strong> {previewEntry?.name?.trim() || t("noName")}
            </p>
            <p>
              <strong>{t("preview.number")}</strong> {previewEntry?.contact || <EmptyValue />}
            </p>
          </div>

          <div className="rounded-[--radius] bg-[#e5ddd5] p-3">
            <div className="overflow-hidden rounded-lg bg-card shadow-sm">
              {header?.text && (
                <div className="border-b border-border px-3 py-2">
                  <p className="whitespace-pre-wrap text-sm font-semibold text-foreground">{renderTemplateText(header.text)}</p>
                </div>
              )}

              <div className="px-3 py-2">
                <p className="whitespace-pre-wrap text-sm text-foreground">{renderTemplateText(body?.text)}</p>
              </div>

              {footer?.text && (
                <div className="px-3 py-1">
                  <p className="whitespace-pre-wrap text-xs text-muted-foreground">{renderTemplateText(footer.text)}</p>
                </div>
              )}

              {buttons?.length ? (
                <div className="border-t border-border">
                  {buttons.map((button, index) => (
                    <div key={index} className="w-full border-b border-border px-3 py-2 text-center text-sm font-medium text-[#00a884] last:border-b-0">
                      {button.text}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {contentLocked && campaignExit.verdict ? <ButtonDestinations buttons={campaignExit.verdict.buttons} overrides={campaignExit.overrides} /> : null}

          <div>
            <GrainBackground
              palette={"alert"}
              seed={20000}
              className="rounded-lg border p-3 transition-shadow"
              data-tour="wc-confirm-template"
            >
              <ElevatedSwitch checked={templateInfoConfirmed} onCheckedChange={confirmTemplate} label={t("validation.confirmTemplateLabel")} />
              {mode === "create" && !templateInfoConfirmed ? <p className="mt-2 text-xs text-destructive-ink">{t("validation.confirmTemplateRequired")}</p> : null}
            </GrainBackground>
          </div>
        </div>
      )}
    </ElevatedContainer>
  );
}

export function TemplateMediaModal({ f }: FormProps) {
  if (!f.selectedTemplate || !f.isAdmin) return null;
  return <TemplateEditModal isOpen={f.mediaModalOpen} onClose={() => f.setMediaModalOpen(false)} template={f.selectedTemplate} onSave={f.handleSaveHeaderMedia} isSaving={f.isSavingMedia} />;
}
