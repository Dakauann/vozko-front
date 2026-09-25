"use client";

import {
    ElevatedDialog,
    ElevatedDialogContent,
    ElevatedDialogDescription,
    ElevatedDialogHeader,
    ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ScheduleWhenField, { useScheduleWhen } from "./ScheduleWhenField";
import type { ScheduledMessage, SchedulingWindow } from "@/lib/scheduled-messages/types";
import { type TemplateComposerInitial, useTemplateComposer } from "@/hooks/use-template-composer";
import { Warning, WarningCircle } from "@/components/icons";
import { useCallback, useMemo, useState } from "react";

import Button from "@/components/elevated-design/button";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import type { EntryType } from "@/lib/conversations/types";
import { TemplateConversationPreview } from "@/components/whatsapp/template-conversation-preview";
import { TemplateVariableFields } from "@/components/whatsapp/template-variable-fields";
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
        composer.templateId && !composer.missingValues && when.valid && !submitting,
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

    const noTemplates =
        !composer.templatesLoading && composer.templates.length > 0 && composer.readyTemplates.length === 0;
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

                <div className="-mx-7 min-h-0 flex-1 overflow-y-auto px-7">
                    <div className="grid gap-x-6 gap-y-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                        <div className="space-y-5">
                            {!businessPhoneId ? (
                                <p className="text-2xs text-muted-foreground">{t("templateDialog.noNumber")}</p>
                            ) : (
                                <ElevatedCommandSelect
                                    label={t("templateDialog.templateLabel")}
                                    value={composer.templateId}
                                    onValueChange={composer.selectTemplate}
                                    options={composer.templateOptions}
                                    disabled={composer.templatesLoading}
                                    isLoading={composer.templatesLoading}
                                    searchPlaceholder={t("templateDialog.templateSearch")}
                                    emptyMessage={t("templateDialog.templateEmpty")}
                                    contentClassName="z-[200]"
                                    fullWidth
                                />
                            )}

                            {noTemplates && (
                                <p className="text-2xs text-muted-foreground">{t("templateDialog.noTemplates")}</p>
                            )}

                            <TemplateVariableFields
                                slots={composer.slots}
                                bodyValues={composer.bodyValues}
                                headerValues={composer.headerValues}
                                onBodyChange={composer.setBodyValue}
                                onHeaderChange={composer.setHeaderValue}
                            />

                            <ScheduleWhenField when={when} />
                        </div>

                        <div className="space-y-3 lg:sticky lg:top-0 lg:self-start">
                            <span className="legend">{t("templateDialog.previewLabel")}</span>
                            <TemplateConversationPreview
                                metadata={composer.previewMetadata}
                                dateLabel={when.chosen ? when.chosen.toLocaleDateString() : ""}
                                emptyLabel={t("templateDialog.previewEmpty")}
                                className="min-h-[200px]"
                            />

                            {composer.templateId && (
                                <div className="rounded-lg border border-border bg-muted p-3">
                                    <p className="text-xs text-foreground">
                                        {composer.priceLabel
                                            ? t("templateDialog.charge", { price: composer.priceLabel })
                                            : t("templateDialog.chargeUnknown")}
                                    </p>
                                    {composer.quote && !composer.quote.affordable && (
                                        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-destructive-ink">
                                            <WarningCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" weight="fill" aria-hidden />
                                            {t("templateDialog.insufficientNow")}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {errorCopy && (
                        <div className="mt-4 flex items-start gap-2 rounded-[--radius] border border-border bg-card px-3 py-2">
                            <Warning weight="fill" className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-ink" />
                            <p className="text-2xs text-foreground">{errorCopy}</p>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 px-1 pb-1">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        title={t("dialog.cancel")}
                        disabled={submitting}
                    />
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        title={submitting ? t("dialog.scheduling") : t("templateDialog.confirm")}
                        disabled={!canSubmit}
                    />
                </div>
            </ElevatedDialogContent>
        </ElevatedDialog>
    );
}
