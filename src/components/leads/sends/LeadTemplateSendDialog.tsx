"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";

import { listBusinessPhonesAction } from "@/app/actions/whatsapp-business-phones";
import Button from "@/components/elevated-design/button";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { PhonePicker } from "@/components/whatsapp/start-official-conversation-dialog";
import { TemplateConversationPreview } from "@/components/whatsapp/template-conversation-preview";
import { TemplateExitGate } from "@/components/whatsapp/exit/TemplateExitGate";
import { useExitAcknowledgement } from "@/components/whatsapp/exit/use-exit-acknowledgement";
import { useWorkspace } from "@/contexts/workspace-context";
import { useLeadFieldDefinitions } from "@/hooks/use-lead-field-definitions";
import { useTemplateComposer } from "@/hooks/use-template-composer";
import { codedErrorMessage } from "@/lib/api/coded-error";
import type { LeadActionRequest } from "@/lib/leads/actions";
import {
  bindingChoices,
  bindingPreviewValues,
  defaultBindings,
  sizedBindings,
  templateSendParams,
  type VariableBinding,
} from "@/lib/leads/sends";
import { isTemplateSendable, templateMessageMetadata, type TemplateParamSlots } from "@/lib/whatsapp-templates/params";

import { SendDepartmentField, useSendDepartment } from "./SendDepartmentField";
import { BindingList, SendSummaryLine } from "./SendSummary";
import { LeadSendDialogFrame, useLeadSendDialog, type LeadSendDialogProps } from "./LeadSendDialogFrame";
import { VariableBindingFields } from "./VariableBindingFields";
import { useBindingLabel } from "./send-copy";
import { useTemplateSlots, type TemplateSlot } from "./use-template-slots";

const PHONES_PAGE = 50;

const NUMBERED = /^\d+$/;

function paramSlotsOf(slots: readonly TemplateSlot[]): TemplateParamSlots {
  return {
    header: slots.filter((slot) => slot.header).map((slot) => slot.name),
    body: slots.filter((slot) => !slot.header).map((slot) => slot.name),
    named: slots.some((slot) => !NUMBERED.test(slot.name)),
  };
}

export function useConnectedPhones() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  return useQuery({
    queryKey: ["lead-send-phones", workspaceId],
    queryFn: async () => {
      const result = await listBusinessPhonesAction({ status: "CONNECTED", page: 1, pageSize: PHONES_PAGE });
      if (result.error) throw new Error(result.error);
      return result.phones;
    },
    enabled: workspaceId !== "",
    staleTime: 60_000,
    retry: false,
  });
}

export function LeadTemplateSendDialog({ selection, size, onClose }: LeadSendDialogProps) {
  const t = useTranslations("leadSends");
  const tCategory = useTranslations("whatsappTemplates.category");
  const format = useFormatter();
  const tAudience = useTranslations("campaignAudience");
  const tDialog = useTranslations("leadsPage.bulk.dialog");
  const [openedAt] = useState(() => new Date());
  const phones = useConnectedPhones();
  const list = phones.data ?? [];
  const [phoneChoice, setPhoneChoice] = useState("");
  const phoneId = phoneChoice || (list.length === 1 ? list[0].id : "");
  const phone = list.find((candidate) => candidate.id === phoneId) ?? null;
  const composer = useTemplateComposer({ businessPhoneId: phoneId, enabled: phoneId !== "", quote: false });
  const { template, templateId } = composer;
  const templateSlots = useTemplateSlots({ selection, templateId, businessPhoneId: phoneId });
  const serverSlots = templateSlots.slots;
  const exitGate = useExitAcknowledgement(templateId);
  const [name, setName] = useState<string | null>(null);
  const department = useSendDepartment();
  const [split, setSplit] = useState(false);
  const fields = useLeadFieldDefinitions().definitions;
  const choices = useMemo(() => bindingChoices(fields), [fields]);
  const labelOf = useBindingLabel(choices);

  const slotCount = serverSlots?.length ?? 0;
  const [bound, setBound] = useState<{ templateId: string; bindings: VariableBinding[] }>({ templateId: "", bindings: [] });
  if (bound.templateId !== templateId || bound.bindings.length !== slotCount) {
    setBound({
      templateId,
      bindings: bound.templateId === templateId && bound.bindings.length > 0 ? sizedBindings(bound.bindings, slotCount) : defaultBindings(slotCount),
    });
  }
  const bindings = bound.bindings;

  const proposedName = template ? t("name.template", { template: template.name, date: format.dateTime(openedAt, { dateStyle: "short" }) }) : "";
  const sendName = name ?? proposedName;
  const slotsReady = serverSlots !== null && !templateSlots.loading && templateSlots.error === null;

  const params = templateSendParams({
    name: sendName,
    departmentId: department.departmentId,
    departmentRequired: department.required,
    split,
    businessPhoneId: phoneId,
    templateId,
    bindings,
    slots: slotCount,
  });
  const request: LeadActionRequest | null =
    params && slotsReady && department.ready && !exitGate.blocks ? { action: "send_template", params: { send: { ...params, ...exitGate.fields } }, selection } : null;
  const state = useLeadSendDialog({ action: "send_template", request, onClose, onDepartmentRequired: department.reload });

  const canContinue =
    template !== null &&
    isTemplateSendable(template) &&
    slotsReady &&
    !exitGate.blocks &&
    sendName.trim() !== "" &&
    department.ready;

  const previewValues = bindingPreviewValues(bindings, labelOf);
  const headerCount = (serverSlots ?? []).filter((slot) => slot.header).length;
  const metadata = templateMessageMetadata(template, previewValues.slice(headerCount), previewValues.slice(0, headerCount), paramSlotsOf(serverSlots ?? []));
  const preview = (
    <div className="space-y-2">
      <span className="legend">{t("template.previewLabel")}</span>
      <TemplateConversationPreview metadata={metadata} withHistory={false} emptyLabel={t("template.previewEmpty")} className="min-h-[160px]" />
    </div>
  );

  const compose = (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
      <div className="space-y-4">
        {phones.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t("template.loadingPhones")}
          </p>
        ) : phones.isError ? (
          <p role="alert" className="text-sm text-destructive-ink">
            {t("template.phonesFailed")}
          </p>
        ) : list.length === 0 ? (
          <p className="rounded-[--radius] border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">{t("template.noPhones")}</p>
        ) : (
          <>
            <PhonePicker phones={list} value={phoneId} onChange={setPhoneChoice} legend={t("template.from")} />
            <ElevatedCommandSelect
              label={t("template.label")}
              value={templateId}
              onValueChange={composer.selectTemplate}
              options={composer.templateOptions}
              disabled={!phoneId || composer.templatesLoading}
              isLoading={composer.templatesLoading}
              searchPlaceholder={t("template.search")}
              emptyMessage={t("template.empty")}
              contentClassName="z-[200]"
              fullWidth
            />
            {!phoneId ? <p className="text-xs text-muted-foreground">{t("template.pickPhone")}</p> : null}
            {phoneId && !composer.templatesLoading && composer.readyTemplates.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("template.noTemplates")}</p>
            ) : null}
            <TemplateExitGate gate={exitGate} />
            {templateId && templateSlots.loading ? (
              <p role="status" className="text-xs text-muted-foreground">
                {t("template.slotsLoading")}
              </p>
            ) : null}
            {templateId && templateSlots.error && !templateSlots.loading ? (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-destructive-ink">{codedErrorMessage(tAudience, templateSlots.error, t("template.slotsFailed"))}</span>
                <Button variant="secondary" size="sm" title={tDialog("retry")} onClick={templateSlots.reload} />
              </div>
            ) : null}
          </>
        )}
        <ElevatedInput label={t("name.label")} placeholder=" " value={sendName} onChange={(event) => setName(event.target.value)} />
        <SendDepartmentField department={department} />
      </div>
      {preview}
    </div>
  );

  const variables = (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
      {slotCount > 0 ? (
        <VariableBindingFields
          slots={serverSlots ?? []}
          binding={{
            choices,
            values: bindings,
            labelOf,
            onChange: (index, binding) => setBound((current) => ({ ...current, bindings: current.bindings.map((item, at) => (at === index ? binding : item)) })),
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{t("bindings.none")}</p>
      )}
      {preview}
    </div>
  );

  const category = state.flow.review?.quote.category ?? template?.category ?? "";
  const categoryKey = category.toLowerCase();
  const categoryLabel = category && tCategory.has(categoryKey) ? tCategory(categoryKey) : category;
  const summaryValues = { phone: phone?.displayPhoneNumber ?? "", template: template?.name ?? "" };
  const from = categoryLabel ? t("template.summaryCategory", { ...summaryValues, category: categoryLabel }) : t("template.summary", summaryValues);

  const summary = (
    <>
      <span className="legend">{t("review.howItArrives")}</span>
      <TemplateConversationPreview metadata={metadata} withHistory={false} emptyLabel={t("template.previewEmpty")} />
      <BindingList bindings={bindings} labelOf={labelOf} />
      <SendSummaryLine from={from} departmentName={department.name} />
    </>
  );

  return (
    <LeadSendDialogFrame
      state={state}
      selection={selection}
      size={size}
      steps={[t("steps.template"), t("steps.variables"), t("steps.review")]}
      canContinue={canContinue}
      split={split}
      onSplit={setSplit}
      compose={compose}
      variables={variables}
      summary={summary}
    />
  );
}
