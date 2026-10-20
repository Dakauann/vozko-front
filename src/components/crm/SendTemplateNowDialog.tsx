"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { Warning } from "@/components/icons";
import { type TemplateComposerInitial, useTemplateComposer } from "@/hooks/use-template-composer";
import { TemplatePickerFields } from "./TemplatePickerFields";

interface SendTemplateNowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessPhoneId: string;
  recipientName?: string;
  initial?: TemplateComposerInitial;
  onSend: (templateId: string, parameters: string[]) => void;
}

export default function SendTemplateNowDialog({
  open,
  onOpenChange,
  businessPhoneId,
  recipientName,
  initial,
  onSend,
}: SendTemplateNowDialogProps) {
  const t = useTranslations("crmComposer.templateNow");
  const scheduleT = useTranslations("scheduledMessages");
  const composer = useTemplateComposer({ businessPhoneId, enabled: open, initial });
  const needsHeaderValues = composer.slots.header.length > 0;
  const canSend = composer.ready && !needsHeaderValues;

  const send = () => {
    if (!canSend) return;
    onSend(composer.templateId, composer.bodyValues);
    onOpenChange(false);
  };

  return (
    <ElevatedDialog open={open} onOpenChange={onOpenChange}>
      <ElevatedDialogContent className="max-h-[min(88vh,820px)] overflow-hidden sm:max-w-[760px]">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>
            {recipientName ? `${scheduleT("dialog.to", { name: recipientName })} · ` : ""}
            {t("description")}
          </ElevatedDialogDescription>
        </ElevatedDialogHeader>

        <div className="-mx-7 min-h-0 flex-1 overflow-y-auto px-7 pb-1 pt-2">
          <TemplatePickerFields
            composer={composer}
            businessPhoneId={businessPhoneId}
            previewDateLabel={new Date().toLocaleDateString()}
            notice={
              needsHeaderValues && (
                <div className="flex items-start gap-2 rounded-[--radius] border border-border bg-card px-3 py-2">
                  <Warning weight="fill" className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-ink" />
                  <p className="text-2xs text-foreground">{t("headerUnsupported")}</p>
                </div>
              )
            }
          />
        </div>

        <ElevatedDialogFooter className="-mx-7 shrink-0 border-t border-border px-7 pt-4">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} title={scheduleT("dialog.cancel")} />
          <Button type="button" variant="primary" onClick={send} title={t("confirm")} disabled={!canSend} />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
