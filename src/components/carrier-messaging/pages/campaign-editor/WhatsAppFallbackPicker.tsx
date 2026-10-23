"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import { useConnectedPhones } from "@/components/leads/sends/LeadTemplateSendDialog";
import { VariableBindingFields } from "@/components/leads/sends/VariableBindingFields";
import { useBindingLabel } from "@/components/leads/sends/send-copy";
import { PhonePicker } from "@/components/whatsapp/start-official-conversation-dialog";
import { TemplateConversationPreview } from "@/components/whatsapp/template-conversation-preview";
import { useLeadFieldDefinitions } from "@/hooks/use-lead-field-definitions";
import { useTemplateComposer } from "@/hooks/use-template-composer";
import type { CampaignWhatsAppFallback } from "@/lib/carrier-messaging/campaigns";
import { bindingChoices, bindingPreviewValues, defaultBindings, sizedBindings, type VariableBinding } from "@/lib/leads/sends";
import { templateMessageMetadata, templateParamSlots } from "@/lib/whatsapp-templates/params";

import type { WhatsAppTemplateSlot } from "./FallbackStep";

function replaced(bindings: readonly VariableBinding[], index: number, binding: VariableBinding): VariableBinding[] {
  return bindings.map((item, at) => (at === index ? binding : item));
}

function WhatsAppFallbackFields({ value, onChange }: { value: CampaignWhatsAppFallback | undefined; onChange: (next: CampaignWhatsAppFallback | undefined) => void }) {
  const t = useTranslations("carrierMessaging.pages.campaignHost.whatsapp");
  const phones = useConnectedPhones();
  const list = useMemo(() => phones.data ?? [], [phones.data]);
  const [enabled, setEnabled] = useState(Boolean(value));
  const [phoneChoice, setPhoneChoice] = useState(value?.business_phone_id ?? "");
  const phoneId = phoneChoice || (list.length === 1 ? list[0].id : "");
  const composer = useTemplateComposer({ businessPhoneId: phoneId, enabled: enabled && phoneId !== "", quote: false });
  const templateId = value?.business_phone_id === phoneId ? value.template_id : "";
  const template = composer.templates.find((candidate) => candidate.id === templateId) ?? null;
  const slots = templateParamSlots(template);
  const fields = useLeadFieldDefinitions().definitions;
  const choices = useMemo(() => bindingChoices(fields), [fields]);
  const labelOf = useBindingLabel(choices);
  const body = sizedBindings(value?.body_bindings ?? [], slots.body.length);
  const header = sizedBindings(value?.header_bindings ?? [], slots.header.length);
  const metadata = templateMessageMetadata(template, bindingPreviewValues(body, labelOf), bindingPreviewValues(header, labelOf), slots);

  const toggle = (next: boolean) => {
    setEnabled(next);
    if (!next) onChange(undefined);
  };

  const chooseTemplate = (id: string) => {
    const chosen = composer.templates.find((candidate) => candidate.id === id) ?? null;
    const chosenSlots = templateParamSlots(chosen);
    onChange({ business_phone_id: phoneId, template_id: id, body_bindings: defaultBindings(chosenSlots.body.length), header_bindings: defaultBindings(chosenSlots.header.length) });
  };

  return (
    <div className="space-y-4">
      <ElevatedSwitch checked={enabled} onCheckedChange={toggle} label={t("toggle")} description={t("toggleHint")} />
      {enabled ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
          <div className="space-y-4">
            {phones.isPending ? (
              <p role="status" className="text-sm text-muted-foreground">
                {t("loadingPhones")}
              </p>
            ) : phones.isError ? (
              <p role="alert" className="text-sm text-destructive-ink">
                {t("phonesFailed")}
              </p>
            ) : list.length === 0 ? (
              <p className="rounded-[--radius] border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">{t("noPhones")}</p>
            ) : (
              <>
                <PhonePicker
                  phones={list}
                  value={phoneId}
                  onChange={(id) => {
                    setPhoneChoice(id);
                    if (value && value.business_phone_id !== id) onChange(undefined);
                  }}
                  legend={t("from")}
                />
                <ElevatedCommandSelect
                  label={t("template")}
                  value={templateId}
                  onValueChange={chooseTemplate}
                  options={composer.templateOptions}
                  disabled={!phoneId || composer.templatesLoading}
                  isLoading={composer.templatesLoading}
                  searchPlaceholder={t("search")}
                  emptyMessage={t("empty")}
                  contentClassName="z-[200]"
                  fullWidth
                />
                {phoneId && !composer.templatesLoading && composer.readyTemplates.length === 0 ? <p className="text-xs text-muted-foreground">{t("noTemplates")}</p> : null}
                {value && slots.header.length > 0 ? (
                  <VariableBindingFields
                    slots={slots.header}
                    binding={{ choices, values: header, labelOf, onChange: (index, binding) => onChange({ ...value, header_bindings: replaced(header, index, binding) }) }}
                  />
                ) : null}
                {value && slots.body.length > 0 ? (
                  <VariableBindingFields
                    slots={slots.body}
                    binding={{ choices, values: body, labelOf, onChange: (index, binding) => onChange({ ...value, body_bindings: replaced(body, index, binding) }) }}
                  />
                ) : null}
              </>
            )}
          </div>
          <div className="space-y-2">
            <span className="legend">{t("preview")}</span>
            <TemplateConversationPreview metadata={metadata} withHistory={false} emptyLabel={t("previewEmpty")} className="min-h-[160px]" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const whatsappFallbackSlot: WhatsAppTemplateSlot = (value, onChange) => <WhatsAppFallbackFields value={value} onChange={onChange} />;
