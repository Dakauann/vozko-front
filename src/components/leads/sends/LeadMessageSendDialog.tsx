"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { CampaignMediaPicker, MEDIA_ACCEPT } from "@/components/campaigns/CampaignMediaPicker";
import Button from "@/components/elevated-design/button";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import {
  CampaignMessageComposer,
  parameterCount,
  unofficialMessageReady,
} from "@/components/unofficial-whatsapp/campaign-message-composer";
import { CampaignPacingPanel, DEFAULT_SEND_DELAY_MS } from "@/components/unofficial-whatsapp/campaign-pacing-panel";
import { InstanceIssueLine, useUnofficialInstanceSelect } from "@/components/unofficial-whatsapp/instance-select";
import { useLeadFieldDefinitions } from "@/hooks/use-lead-field-definitions";
import type { LeadActionRequest } from "@/lib/leads/actions";
import {
  bindingChoices,
  bindingPreviewValues,
  defaultBindings,
  messageSendParams,
  sizedBindings,
  type VariableBinding,
} from "@/lib/leads/sends";
import type { UnofficialWhatsAppMessageSpec } from "@/lib/unofficial-whatsapp-campaigns/types";
import { instanceIssue, instanceUnusable, type UnofficialWhatsAppInstance } from "@/lib/unofficial-whatsapp/types";
import { renderTemplateText } from "@/lib/whatsapp-templates/params";

import { SendDepartmentField, useSendDepartment } from "./SendDepartmentField";
import { BindingList, SendSummaryLine } from "./SendSummary";
import { LeadSendDialogFrame, useLeadSendDialog, type LeadSendDialogProps } from "./LeadSendDialogFrame";
import { OutgoingBubble } from "./OutgoingBubble";
import { VariableBindingFields } from "./VariableBindingFields";
import { useBindingLabel } from "./send-copy";

const EMPTY_MESSAGE: UnofficialWhatsAppMessageSpec = { kind: "text", bodies: [""] };

function slotNames(count: number): string[] {
  return Array.from({ length: count }, (_, index) => String(index + 1));
}

export function LeadMessageSendDialog({ selection, size, onClose }: LeadSendDialogProps) {
  const t = useTranslations("leadSends");
  const tCampaigns = useTranslations("unofficialWhatsappCampaigns");
  const tDialog = useTranslations("leadsPage.bulk.dialog");
  const format = useFormatter();
  const [openedAt] = useState(() => new Date());
  const [instance, setInstance] = useState<UnofficialWhatsAppInstance | null>(null);
  const [message, setMessage] = useState<UnofficialWhatsAppMessageSpec>(EMPTY_MESSAGE);
  const [pacing, setPacing] = useState<{ minMs: number; maxMs: number; dailyCap: number }>({
    minMs: DEFAULT_SEND_DELAY_MS.min,
    maxMs: DEFAULT_SEND_DELAY_MS.max,
    dailyCap: 0,
  });
  const [name, setName] = useState<string | null>(null);
  const [split, setSplit] = useState(false);
  const department = useSendDepartment();
  const fields = useLeadFieldDefinitions().definitions;
  const choices = useMemo(() => bindingChoices(fields), [fields]);
  const labelOf = useBindingLabel(choices);

  const instanceSelect = useUnofficialInstanceSelect();
  const instanceId = instance?.id ?? "";
  const issue = instance ? instanceIssue(instance) : null;

  const slotCount = parameterCount(message);
  const [bindings, setBindings] = useState<VariableBinding[]>([]);
  if (bindings.length !== slotCount) {
    setBindings(bindings.length === 0 ? defaultBindings(slotCount) : sizedBindings(bindings, slotCount));
  }

  const proposedName = t("name.message", { date: format.dateTime(openedAt, { dateStyle: "short" }) });
  const sendName = name ?? proposedName;
  const ready = unofficialMessageReady(message);
  const params = messageSendParams(
    {
      name: sendName,
      departmentId: department.departmentId,
      departmentRequired: department.required,
      split,
      instanceId,
      message,
      sendDelayMinMs: pacing.minMs,
      sendDelayMaxMs: pacing.maxMs,
      dailyCap: pacing.dailyCap,
      bindings,
      slots: slotCount,
    },
    ready,
  );
  const request: LeadActionRequest | null = params && department.ready ? { action: "send_unofficial", params: { send: params }, selection } : null;
  const state = useLeadSendDialog({ action: "send_unofficial", request, onClose, onDepartmentRequired: department.reload });

  const canContinue =
    instanceId !== "" &&
    !instanceUnusable(issue) &&
    ready &&
    sendName.trim() !== "" &&
    department.ready;

  const slots = { body: slotNames(slotCount), header: [], named: false };
  const previewText = renderTemplateText(message.bodies[0] ?? "", bindingPreviewValues(bindings, labelOf), slots.body);
  const bubble = (
    <div className="space-y-2">
      <span className="legend">{t("template.previewLabel")}</span>
      <OutgoingBubble text={previewText} emptyLabel={t("message.previewEmpty")} className="ml-auto" />
    </div>
  );

  const compose = (
    <div className="space-y-4">
      <div className="space-y-1">
        <ElevatedCommandSelect
          label={t("message.instance")}
          value={instanceId}
          onValueChange={(id) => setInstance(instanceSelect.items.find((candidate) => candidate.id === id) ?? null)}
          options={instanceSelect.options}
          searchPlaceholder={t("message.search")}
          emptyMessage={t("message.empty")}
          onSearch={instanceSelect.onSearch}
          onScrollEnd={instanceSelect.onScrollEnd}
          onOpenChange={instanceSelect.onOpenChange}
          isLoading={instanceSelect.isLoading}
          contentClassName="z-[200]"
          fullWidth
        />
        {instanceSelect.failed ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-destructive-ink">{t("message.instancesFailed")}</span>
            <Button variant="secondary" size="sm" title={tDialog("retry")} onClick={instanceSelect.reload} />
          </div>
        ) : null}
        <InstanceIssueLine issue={issue} />
      </div>
      <div className="space-y-2">
        <span className="legend">{t("message.content")}</span>
        <CampaignMessageComposer
          value={message}
          onChange={setMessage}
          mediaSlot={
            <CampaignMediaPicker
              kind={message.kind}
              mediaId={message.mediaId}
              fileName={message.fileName}
              accept={MEDIA_ACCEPT[message.kind] ?? "*/*"}
              onChange={(next) => setMessage({ ...message, mediaId: next.mediaId, fileName: next.fileName })}
              labels={{
                upload: tCampaigns("form.mediaUpload"),
                uploading: tCampaigns("form.mediaUploading"),
                remove: tCampaigns("form.mediaRemove"),
                failed: tCampaigns("form.mediaFailed"),
              }}
            />
          }
        />
        {!ready && message.bodies.some((body) => body.trim() !== "") ? <p className="text-xs text-muted-foreground">{t("message.incomplete")}</p> : null}
      </div>
      <ElevatedInput label={t("name.label")} placeholder=" " value={sendName} onChange={(event) => setName(event.target.value)} />
      <SendDepartmentField department={department} />
    </div>
  );

  const variables = (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        {slotCount > 0 ? (
          <VariableBindingFields
            slots={slots.body}
            binding={{
              choices,
              values: bindings,
              labelOf,
              onChange: (index, binding) => setBindings((current) => current.map((item, at) => (at === index ? binding : item))),
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t("bindings.none")}</p>
        )}
        {bubble}
      </div>
      <CampaignPacingPanel
        minMs={pacing.minMs}
        maxMs={pacing.maxMs}
        dailyCap={pacing.dailyCap}
        instance={instance}
        onChange={(patch) => setPacing((current) => ({ ...current, ...patch }))}
      />
    </div>
  );

  const summary = (
    <>
      <span className="legend">{t("review.howItArrives")}</span>
      <OutgoingBubble text={previewText} emptyLabel={t("message.previewEmpty")} />
      <BindingList bindings={bindings} labelOf={labelOf} />
      <SendSummaryLine from={t("message.summary", { instance: instance?.displayName ?? "" })} departmentName={department.name} />
    </>
  );

  return (
    <LeadSendDialogFrame
      state={state}
      selection={selection}
      size={size}
      steps={[t("steps.message"), t("steps.variables"), t("steps.review")]}
      canContinue={canContinue}
      split={split}
      onSplit={setSplit}
      compose={compose}
      variables={variables}
      summary={summary}
    />
  );
}
