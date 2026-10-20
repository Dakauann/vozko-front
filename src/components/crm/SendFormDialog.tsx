"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { sendFormInConversationAction } from "@/app/actions/whatsapp-forms";
import Button from "@/components/elevated-design/button";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { Notice } from "@/components/ui/notice";
import { useSendableForms } from "@/hooks/use-sendable-forms";
import { codedErrorMessage, type CodedRefusal } from "@/lib/api/coded-error";
import { FORM_COPY_LIMITS, formCopyOf, type FormCopyDraft } from "@/lib/conversations/form-send";
import { isOutsideWindow } from "@/lib/whatsapp-forms/errors";

interface SendFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId: string;
  businessPhoneId: string;
  recipientName?: string;
  onUseTemplate?: () => void;
}

function Counter({ count, limit }: { count: number; limit: number }) {
  const t = useTranslations("crmComposer.form");
  return (
    <p className={count > limit ? "mt-1 text-2xs tabular-nums text-destructive-ink" : "mt-1 text-2xs tabular-nums text-muted-foreground"}>
      {t("count", { count, limit })}
    </p>
  );
}

export default function SendFormDialog({ open, onOpenChange, ...rest }: SendFormDialogProps) {
  return (
    <ElevatedDialog open={open} onOpenChange={onOpenChange}>
      <ElevatedDialogContent className="max-h-[min(88vh,820px)] overflow-hidden sm:max-w-[560px]">
        {open ? <SendFormPanel onOpenChange={onOpenChange} {...rest} /> : null}
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}

function SendFormPanel({ onOpenChange, entryId, businessPhoneId, recipientName, onUseTemplate }: Omit<SendFormDialogProps, "open">) {
  const t = useTranslations("crmComposer.form");
  const scheduleT = useTranslations("scheduledMessages");
  const { forms, loading, error: listError } = useSendableForms(businessPhoneId ? { phoneId: businessPhoneId } : null);
  const [formId, setFormId] = useState("");
  const [copy, setCopy] = useState<FormCopyDraft>(() => ({ header: "", body: t("defaultBody"), footer: "", cta: t("defaultCta") }));
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<CodedRefusal | null>(null);
  const outsideWindow = failure !== null && isOutsideWindow(failure);
  const canSend = Boolean(formId) && copy.body.trim() !== "" && copy.cta.trim() !== "" && !sending;

  const edit = (key: keyof FormCopyDraft, value: string) => setCopy((current) => ({ ...current, [key]: value }));

  const send = () => {
    if (!canSend) return;
    setSending(true);
    setFailure(null);
    sendFormInConversationAction(entryId, formId, formCopyOf(copy)).then((answer) => {
      setSending(false);
      if (answer.error) {
        setFailure(answer.error);
        return;
      }
      toast.success(t("sent"));
      onOpenChange(false);
    });
  };

  const useTemplate = () => {
    onOpenChange(false);
    onUseTemplate?.();
  };

  return (
    <>
      <ElevatedDialogHeader>
        <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
        <ElevatedDialogDescription>
          {recipientName ? `${scheduleT("dialog.to", { name: recipientName })} · ` : ""}
          {t("description")}
        </ElevatedDialogDescription>
      </ElevatedDialogHeader>

      <div className="-mx-7 min-h-0 flex-1 space-y-4 overflow-y-auto px-7 pb-1 pt-2">
        <div className="space-y-1">
          <ElevatedCommandSelect
            label={t("form")}
            value={formId}
            options={forms.map((form) => ({ value: form.formId, label: form.name }))}
            onValueChange={(value) => setFormId(value)}
            searchPlaceholder={t("search")}
            emptyMessage={t("empty")}
            isLoading={loading}
          />
          {listError ? <p className="text-2xs text-destructive-ink">{t("loadFailed")}</p> : null}
        </div>

        <div>
          <ElevatedInput label={t("header")} value={copy.header} onChange={(e) => edit("header", e.target.value)} />
          <Counter count={copy.header.length} limit={FORM_COPY_LIMITS.header} />
        </div>
        <div>
          <ElevatedTextarea label={t("body")} value={copy.body} onChange={(e) => edit("body", e.target.value)} rows={4} />
          <Counter count={copy.body.length} limit={FORM_COPY_LIMITS.body} />
        </div>
        <div>
          <ElevatedInput label={t("footer")} value={copy.footer} onChange={(e) => edit("footer", e.target.value)} />
          <Counter count={copy.footer.length} limit={FORM_COPY_LIMITS.footer} />
        </div>
        <div>
          <ElevatedInput label={t("cta")} value={copy.cta} onChange={(e) => edit("cta", e.target.value)} />
          <Counter count={copy.cta.length} limit={FORM_COPY_LIMITS.cta} />
        </div>

        {outsideWindow ? (
          <Notice tone="warning" title={t("outsideWindow.title")}>
            <p>{t("outsideWindow.text")}</p>
            {onUseTemplate ? (
              <div className="pt-1">
                <Button type="button" variant="secondary" size="sm" onClick={useTemplate} title={t("outsideWindow.useTemplate")} />
              </div>
            ) : null}
          </Notice>
        ) : failure ? (
          <Notice tone="fault">{codedErrorMessage(t, failure, t("sendFailed"))}</Notice>
        ) : null}
      </div>

      <ElevatedDialogFooter className="-mx-7 shrink-0 border-t border-border px-7 pt-4">
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} title={scheduleT("dialog.cancel")} />
        <Button type="button" variant="primary" onClick={send} title={sending ? t("sending") : t("send")} disabled={!canSend} />
      </ElevatedDialogFooter>
    </>
  );
}
