"use client";

import {
    ElevatedDialog,
    ElevatedDialogContent,
    ElevatedDialogDescription,
    ElevatedDialogHeader,
    ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { File as FileIcon, Paperclip, Warning, Waveform, X } from "@/components/icons";
import {
    OUTBOUND_MEDIA_ACCEPT,
    formatFileSize,
    mediaTypeForFile,
    normalizeUploadFile,
} from "@/lib/conversations/media";
import type { EntryType, MediaType } from "@/lib/conversations/types";
import type { ScheduledMessage, SchedulingWindow } from "@/lib/scheduled-messages/types";
import {
    marginBeforeWindowCloses,
    scheduleBounds,
    validateScheduledAt,
} from "@/lib/scheduled-messages/window";
import { useCallback, useMemo, useRef, useState } from "react";

import Button from "@/components/elevated-design/button";
import { ElevatedDatePicker } from "@/components/elevated-design/elevated-date-picker";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { scheduleMessageAction } from "@/app/actions/scheduled-messages";
import { uploadConversationMediaAction } from "@/app/actions/conversations";
import { useTranslations } from "next-intl";

export interface ScheduleDraft {
    text: string;
    mediaId?: string;
    mediaType?: MediaType;
    mediaName?: string;
    replyToMessageId?: string;
    signed: boolean;
}

interface ScheduleMessageDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entryType: EntryType;
    entryId: string;
    recipientName?: string;
    window: SchedulingWindow | null;
    draft: ScheduleDraft;
    onScheduled: (message: ScheduledMessage) => void;
}

interface Attachment {
    name: string;
    size: number;
    type: MediaType;
    uploading: boolean;
    mediaId?: string;
    error?: string;
}

type PresetKey = "1h" | "3h" | "tomorrow" | "custom";

const HOUR = 60 * 60 * 1000;

function presetInstant(key: Exclude<PresetKey, "custom">, now: Date): Date {
    if (key === "1h") return new Date(now.getTime() + HOUR);
    if (key === "3h") return new Date(now.getTime() + 3 * HOUR);

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow;
}

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toLocalTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function combine(date: string, time: string): Date | null {
    const [y, m, d] = date.split("-").map(Number);
    const [h, min] = time.split(":").map(Number);
    if (!y || !m || !d || Number.isNaN(h) || Number.isNaN(min)) return null;

    const combined = new Date(y, m - 1, d, h, min, 0, 0);
    return Number.isNaN(combined.getTime()) ? null : combined;
}

function formatDuration(ms: number): string {
    const minutes = Math.max(0, Math.floor(ms / 60_000));
    const hours = Math.floor(minutes / 60);
    if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
}

export default function ScheduleMessageDialog({
    open,
    onOpenChange,
    entryType,
    entryId,
    recipientName,
    window: schedulingWindow,
    draft,
    onScheduled,
}: ScheduleMessageDialogProps) {
    const t = useTranslations("scheduledMessages");

    const [liveWindow, setLiveWindow] = useState<SchedulingWindow | null>(schedulingWindow);
    const [text, setText] = useState(() => (draft.text ?? ""));
    const [signed, setSigned] = useState(draft.signed);
    const [attachment, setAttachment] = useState<Attachment | null>(() =>
        draft.mediaId
            ? {
                  name: draft.mediaName ?? "",
                  size: 0,
                  type: draft.mediaType ?? "document",
                  uploading: false,
                  mediaId: draft.mediaId,
              }
            : null,
    );
    const [submitting, setSubmitting] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [idempotencyKey] = useState(() => crypto.randomUUID());

    const fileInputRef = useRef<HTMLInputElement>(null);

    const bounds = useMemo(() => scheduleBounds(liveWindow), [liveWindow]);

    const [initialInstant] = useState(() => {
        const suggested = presetInstant("1h", new Date());
        const latest = scheduleBounds(schedulingWindow).latest;
        return latest && suggested > latest ? latest : suggested;
    });
    const [preset, setPreset] = useState<PresetKey>(() =>
        initialInstant.getTime() === presetInstant("1h", new Date()).getTime() ? "1h" : "custom",
    );
    const [date, setDate] = useState(() => toLocalDate(initialInstant));
    const [time, setTime] = useState(() => toLocalTime(initialInstant));

    const applyInstant = useCallback((instant: Date) => {
        setDate(toLocalDate(instant));
        setTime(toLocalTime(instant));
    }, []);

    const chosen = useMemo(() => combine(date, time), [date, time]);
    const validity = useMemo(
        () => (chosen ? validateScheduledAt(chosen, liveWindow) : null),
        [chosen, liveWindow],
    );
    const margin = useMemo(
        () => (chosen ? marginBeforeWindowCloses(chosen, liveWindow) : null),
        [chosen, liveWindow],
    );

    const selectPreset = useCallback(
        (key: PresetKey) => {
            setPreset(key);
            if (key !== "custom") applyInstant(presetInstant(key, new Date()));
        },
        [applyInstant],
    );

    const presetOptions = useMemo(() => {
        const now = new Date();
        const keys: Exclude<PresetKey, "custom">[] = ["1h", "3h", "tomorrow"];
        const options = keys.map((key) => {
            const fits = validateScheduledAt(presetInstant(key, now), liveWindow, now).ok;
            return {
                value: key as PresetKey,
                label: t(`dialog.presets.${key}`),
                disabled: !fits,
                title: fits ? undefined : t("dialog.presetPastWindow"),
            };
        });
        return [...options, { value: "custom" as PresetKey, label: t("dialog.presets.custom") }];
    }, [liveWindow, t]);

    const handleFiles = useCallback(
        async (files: FileList | null) => {
            const picked = files?.[0];
            if (!picked) return;

            const file = normalizeUploadFile(picked);
            const type = mediaTypeForFile(file);
            setAttachment({ name: file.name, size: file.size, type, uploading: true });

            const result = await uploadConversationMediaAction(entryType, entryId, file, type);
            setAttachment((current) =>
                current && current.name === file.name
                    ? {
                          ...current,
                          uploading: false,
                          mediaId: result.mediaId ?? undefined,
                          error:
                              result.error ||
                              (result.mediaId ? undefined : t("dialog.uploadFailed")),
                      }
                    : current,
            );
        },
        [entryId, entryType, t],
    );

    const clientError = validity && !validity.ok ? t(`errors.${validity.code}`) : null;
    const isAudio = attachment?.type === "audio";
    const hasContent = text.trim().length > 0 || Boolean(attachment?.mediaId);
    const canSubmit = Boolean(
        chosen && validity?.ok && hasContent && !submitting && !attachment?.uploading,
    );

    const handleSubmit = useCallback(async () => {
        if (!chosen || submitting) return;

        setSubmitting(true);
        setServerError(null);

        const result = await scheduleMessageAction(
            entryType,
            entryId,
            {
                text: isAudio ? "" : text.trim(),
                scheduled_at: chosen.toISOString(),
                media_id: attachment?.mediaId,
                media_type: attachment?.mediaId ? attachment.type : undefined,
                reply_to_message_id: draft.replyToMessageId,
                signed,
            },
            idempotencyKey,
        );
        setSubmitting(false);

        if (result.error) {
            if (result.error.window) setLiveWindow(result.error.window);
            setServerError(
                result.error.code ? t(`errors.${result.error.code}`) : result.error.message,
            );
            return;
        }

        if (result.window) setLiveWindow(result.window);
        if (result.scheduledMessage) onScheduled(result.scheduledMessage);
        onOpenChange(false);
    }, [
        attachment, chosen, draft.replyToMessageId, entryId, entryType, idempotencyKey,
        isAudio, onOpenChange, onScheduled, signed, submitting, t, text,
    ]);

    const deliverySummary = chosen
        ? chosen.toLocaleString(undefined, {
              weekday: "long",
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
          })
        : "";

    return (
        <ElevatedDialog open={open} onOpenChange={onOpenChange}>
            <ElevatedDialogContent className="max-w-lg">
                <ElevatedDialogHeader>
                    <ElevatedDialogTitle>{t("dialog.title")}</ElevatedDialogTitle>
                    <ElevatedDialogDescription>
                        {recipientName ? `${t("dialog.to", { name: recipientName })} · ` : ""}
                        {
}
                        {liveWindow?.expiresAt
                            ? t("dialog.description")
                            : t("dialog.descriptionNoWindow")}
                    </ElevatedDialogDescription>
                </ElevatedDialogHeader>

                <div className="space-y-5 px-1 py-1">
                    <section className="space-y-2">
                        <ElevatedTextarea
                            label={t("dialog.messageLabel")}
                            placeholder={
                                isAudio ? t("dialog.audioNoCaption") : t("dialog.messagePlaceholder")
                            }
                            value={isAudio ? "" : text}
                            disabled={isAudio}
                            onChange={(event) => setText(event.target.value)}
                            rows={4}
                            autoFocus
                        />

                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="inline-flex items-center gap-1.5 rounded-[--radius] border border-border px-2.5 py-1.5 text-2xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <Paperclip weight="bold" className="h-3.5 w-3.5" />
                                {t("dialog.attach")}
                            </button>

                            <label className="inline-flex items-center gap-2 text-2xs font-medium text-muted-foreground">
                                {t("dialog.sign")}
                                <ElevatedSwitch checked={signed} onCheckedChange={setSigned} />
                            </label>
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={OUTBOUND_MEDIA_ACCEPT}
                            className="hidden"
                            onChange={(event) => {
                                void handleFiles(event.target.files);
                                event.target.value = "";
                            }}
                        />

                        {attachment && (
                            <AttachmentChip
                                attachment={attachment}
                                uploadingLabel={t("dialog.uploading")}
                                removeLabel={t("dialog.removeAttachment")}
                                onRemove={() => setAttachment(null)}
                            />
                        )}
                    </section>

                    <section className="space-y-2">
                        <p className="legend">{t("dialog.whenLabel")}</p>

                        <ElevatedPillToggle
                            options={presetOptions}
                            value={preset}
                            onChange={selectPreset}
                            size="sm"
                            aria-label={t("dialog.whenLabel")}
                        />

                        <div className="grid grid-cols-2 gap-3">
                            <ElevatedDatePicker
                                id="schedule-date"
                                label={t("dialog.dateLabel")}
                                value={date}
                                onChange={(value) => {
                                    setPreset("custom");
                                    setDate(value);
                                }}
                                minDate={bounds.earliest ?? undefined}
                                maxDate={bounds.latest ?? undefined}
                                hasError={Boolean(clientError)}
                            />
                            <ElevatedInput
                                id="schedule-time"
                                type="time"
                                label={t("dialog.timeLabel")}
                                value={time}
                                onChange={(event) => {
                                    setPreset("custom");
                                    setTime(event.target.value);
                                }}
                            />
                        </div>

                        {chosen && !clientError && (
                            <p className="text-2xs text-muted-foreground">
                                {t("dialog.deliverySummary", { when: deliverySummary })}
                                {margin !== null
                                    ? ` — ${t("dialog.marginSuffix", { margin: formatDuration(margin) })}`
                                    : ""}
                            </p>
                        )}
                    </section>

                    {(clientError || serverError || attachment?.error) && (
                        <div className="flex items-start gap-2 rounded-[--radius] border border-border bg-card px-3 py-2">
                            <Warning
                                weight="fill"
                                className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-ink"
                            />
                            <p className="text-2xs text-foreground">
                                {serverError ?? attachment?.error ?? clientError}
                            </p>
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
                        title={submitting ? t("dialog.scheduling") : t("dialog.confirm")}
                        disabled={!canSubmit}
                    />
                </div>
            </ElevatedDialogContent>
        </ElevatedDialog>
    );
}

function AttachmentChip({
    attachment,
    uploadingLabel,
    removeLabel,
    onRemove,
}: {
    attachment: Attachment;
    uploadingLabel: string;
    removeLabel: string;
    onRemove: () => void;
}) {
    const Glyph = attachment.type === "audio" ? Waveform : FileIcon;

    return (
        <div className="flex items-center gap-2 rounded-[--radius] border border-border bg-muted px-2.5 py-1.5">
            <Glyph weight="fill" className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
                <p className="truncate text-2xs font-medium text-foreground">
                    {attachment.name || attachment.type}
                </p>
                <p className="text-2xs text-muted-foreground">
                    {attachment.uploading
                        ? uploadingLabel
                        : attachment.size > 0
                          ? formatFileSize(attachment.size)
                          : ""}
                </p>
            </div>
            <button
                type="button"
                onClick={onRemove}
                aria-label={removeLabel}
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
            >
                <X weight="bold" className="h-3 w-3" />
            </button>
        </div>
    );
}
