"use client";

import {
    ElevatedDialog,
    ElevatedDialogContent,
    ElevatedDialogDescription,
    ElevatedDialogFooter,
    ElevatedDialogHeader,
    ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ScheduleWhenField, { useScheduleWhen } from "./ScheduleWhenField";
import type { ScheduledMessage, SchedulingWindow } from "@/lib/scheduled-messages/types";
import { type TemplateComposerInitial, useTemplateComposer } from "@/hooks/use-template-composer";
import { Warning } from "@/components/icons";
import { useCallback, useMemo, useState } from "react";

import Button from "@/components/elevated-design/button";
import type { EntryType } from "@/lib/conversations/types";
import { TemplatePickerFields } from "./TemplatePickerFields";
import { scheduleMessageAction } from "@/app/actions/scheduled-messages";
import { templateSchedulingWindow } from "@/lib/scheduled-messages/window";
import { useTranslations } from "next-intl";

interface ScheduleTemplateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entryType: EntryType;
    entryId: string;
    businessPhoneId: string;
    recipientName?: string;
    window: SchedulingWindow | null;
    initial?: TemplateComposerInitial;
    onScheduled: (message: ScheduledMessage) => void;
}

export default function ScheduleTemplateDialog({
    open,
    onOpenChange,
    entryType,
    entryId,
    businessPhoneId,
    recipientName,
    window: schedulingWindow,
    initial,
    onScheduled,
}: ScheduleTemplateDialogProps) {
    const t = useTranslations("scheduledMessages");

    const [liveWindow, setLiveWindow] = useState<SchedulingWindow | null>(schedulingWindow);
    const [submitting, setSubmitting] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [idempotencyKey] = useState(() => crypto.randomUUID());

    const composer = useTemplateComposer({ businessPhoneId, enabled: open, initial });
    const templateWindow = useMemo(() => templateSchedulingWindow(liveWindow), [liveWindow]);
    const when = useScheduleWhen(templateWindow);

    const canSubmit = Boolean(
        composer.ready && when.valid && !submitting,
    );

    const handleSubmit = useCallback(async () => {
        if (!when.chosen || submitting) return;

        setSubmitting(true);
        setServerError(null);

        const result = await scheduleMessageAction(
            entryType,
            entryId,
            {
                scheduled_at: when.chosen.toISOString(),
                template: {
                    template_id: composer.templateId,
                    body_params: composer.slots.body.length > 0 ? composer.bodyValues : undefined,
                    header_params: composer.slots.header.length > 0 ? composer.headerValues : undefined,
                },
            },
            idempotencyKey,
        );
        setSubmitting(false);

        if (result.error) {
            if (result.error.window) setLiveWindow(result.error.window);
            setServerError(
                result.error.code && t.has(`errors.${result.error.code}`)
                    ? t(`errors.${result.error.code}`)
                    : result.error.message,
            );
            return;
        }

        if (result.window) setLiveWindow(result.window);
        if (result.scheduledMessage) onScheduled(result.scheduledMessage);
        onOpenChange(false);
    }, [composer, entryId, entryType, idempotencyKey, onOpenChange, onScheduled, submitting, t, when.chosen]);

    const errorCopy = serverError ?? when.clientError;

    return (
        <ElevatedDialog open={open} onOpenChange={onOpenChange}>
            <ElevatedDialogContent className="max-h-[min(88vh,820px)] overflow-hidden sm:max-w-[760px]">
                <ElevatedDialogHeader>
                    <ElevatedDialogTitle>{t("templateDialog.title")}</ElevatedDialogTitle>
                    <ElevatedDialogDescription>
                        {recipientName ? `${t("dialog.to", { name: recipientName })} · ` : ""}
                        {t("templateDialog.description")}
                    </ElevatedDialogDescription>
                </ElevatedDialogHeader>

                <div className="-mx-7 min-h-0 flex-1 overflow-y-auto px-7 pb-1 pt-2">
                    <TemplatePickerFields
                        composer={composer}
                        businessPhoneId={businessPhoneId}
                        previewDateLabel={when.chosen ? when.chosen.toLocaleDateString() : ""}
                        notice={
                            errorCopy && (
                                <div className="flex items-start gap-2 rounded-[--radius] border border-border bg-card px-3 py-2">
                                    <Warning weight="fill" className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-ink" />
                                    <p className="text-2xs text-foreground">{errorCopy}</p>
                                </div>
                            )
                        }
                    >
                        <ScheduleWhenField when={when} />
                    </TemplatePickerFields>
                </div>

                <ElevatedDialogFooter className="-mx-7 shrink-0 border-t border-border px-7 pt-4">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onOpenChange(false)}
                        title={t("dialog.cancel")}
                        disabled={submitting}
                    />
                    <Button
                        type="button"
                        variant="primary"
                        onClick={handleSubmit}
                        title={submitting ? t("dialog.scheduling") : t("templateDialog.confirm")}
                        disabled={!canSubmit}
                    />
                </ElevatedDialogFooter>
            </ElevatedDialogContent>
        </ElevatedDialog>
    );
}
