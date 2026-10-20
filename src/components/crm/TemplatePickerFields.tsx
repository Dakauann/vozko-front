"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import { WarningCircle } from "@/components/icons";
import { QuoteRefusalNotice } from "@/components/whatsapp/quote-refusal-notice";
import { TemplateConversationPreview } from "@/components/whatsapp/template-conversation-preview";
import { TemplateVariableFields } from "@/components/whatsapp/template-variable-fields";
import type { useTemplateComposer } from "@/hooks/use-template-composer";

interface TemplatePickerFieldsProps {
  composer: ReturnType<typeof useTemplateComposer>;
  businessPhoneId: string;
  previewDateLabel: string;
  children?: ReactNode;
  notice?: ReactNode;
}

export function TemplatePickerFields({ composer, businessPhoneId, previewDateLabel, children, notice }: TemplatePickerFieldsProps) {
  const t = useTranslations("scheduledMessages.templateDialog");
  const noTemplates = !composer.templatesLoading && composer.templates.length > 0 && composer.readyTemplates.length === 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <div className="space-y-5">
        {!businessPhoneId ? (
          <p className="text-2xs text-muted-foreground">{t("noNumber")}</p>
        ) : (
          <ElevatedCommandSelect
            label={t("templateLabel")}
            value={composer.templateId}
            onValueChange={composer.selectTemplate}
            options={composer.templateOptions}
            disabled={composer.templatesLoading}
            isLoading={composer.templatesLoading}
            searchPlaceholder={t("templateSearch")}
            emptyMessage={t("templateEmpty")}
            contentClassName="z-[200]"
            fullWidth
          />
        )}

        {noTemplates && <p className="text-2xs text-muted-foreground">{t("noTemplates")}</p>}

        <TemplateVariableFields
          slots={composer.slots}
          bodyValues={composer.bodyValues}
          headerValues={composer.headerValues}
          onBodyChange={composer.setBodyValue}
          onHeaderChange={composer.setHeaderValue}
        />

        {children}

        {composer.quote && !composer.quote.affordable && (
          <p className="flex items-start gap-1.5 text-xs text-destructive-ink">
            <WarningCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" weight="fill" aria-hidden />
            {t("insufficientNow")}
          </p>
        )}

        <QuoteRefusalNotice message={composer.quoteError} onRetry={composer.retryQuote} />

        {notice}
      </div>

      <div className="space-y-2">
        <span className="legend">{t("previewLabel")}</span>
        <TemplateConversationPreview
          metadata={composer.previewMetadata}
          dateLabel={previewDateLabel}
          emptyLabel={t("previewEmpty")}
          className="min-h-[240px]"
        />
      </div>
    </div>
  );
}
