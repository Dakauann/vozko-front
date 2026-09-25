"use client";

import type { ScheduledMessage } from "@/lib/scheduled-messages/types";
import { CaretDown, Clock, Trash, Warning } from "@/components/icons";
import { useCallback, useMemo, useState } from "react";

import { cancelScheduledMessageAction } from "@/app/actions/scheduled-messages";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface ScheduledMessagesPanelProps {
    messages: ScheduledMessage[];
    canManage: boolean;
    canManageTemplates: boolean;
    onChanged: () => void;
    onReuse: (message: ScheduledMessage) => void;
}

export default function ScheduledMessagesPanel({
    messages,
    canManage,
    canManageTemplates,
    onChanged,
    onReuse,
}: ScheduledMessagesPanelProps) {
    const t = useTranslations("scheduledMessages");
    const [expanded, setExpanded] = useState(true);
    const [cancelling, setCancelling] = useState<string | null>(null);

    const visible = useMemo(
        () =>
            messages.filter(
                (m) => m.status === "pending" || m.status === "sending" || m.status === "failed",
            ),
        [messages],
    );

    const handleCancel = useCallback(
        async (id: string) => {
            setCancelling(id);
            await cancelScheduledMessageAction(id);
            setCancelling(null);
            onChanged();
        },
        [onChanged],
    );

    if (visible.length === 0) return null;

    const pendingCount = visible.filter((m) => m.status !== "failed").length;

    return (
        <div className="flex justify-center px-4 pt-2">
            <div className="w-full max-w-[92%] rounded-[--radius] border border-border bg-card shadow-sm">
                <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left"
                    aria-expanded={expanded}
                >
                    <Clock weight="fill" className="h-3.5 w-3.5 flex-shrink-0 text-primary-ink" />
                    <span className="flex-1 text-2xs font-semibold text-foreground">
                        {t("panel.title", { count: pendingCount })}
                    </span>
                    <CaretDown
                        weight="bold"
                        className={cn(
                            "h-3 w-3 text-muted-foreground transition-transform",
                            expanded && "rotate-180",
                        )}
                    />
                </button>

                {expanded && (
                    <ul className="divide-y divide-border border-t border-border">
                        {visible.map((message) => (
                            <ScheduledMessageRow
                                key={message.id}
                                message={message}
                                canManage={message.kind === "template" ? canManageTemplates : canManage}
                                cancelling={cancelling === message.id}
                                onCancel={handleCancel}
                                onReuse={onReuse}
                            />
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

function ScheduledMessageRow({
    message,
    canManage,
    cancelling,
    onCancel,
    onReuse,
}: {
    message: ScheduledMessage;
    canManage: boolean;
    cancelling: boolean;
    onCancel: (id: string) => void;
    onReuse: (message: ScheduledMessage) => void;
}) {
    const t = useTranslations("scheduledMessages");
    const failed = message.status === "failed";

    const failureCopy = failed
        ? t(`failures.${message.failureReason ?? "provider_error"}`)
        : null;

    const when = new Date(message.scheduledAt).toLocaleString(undefined, {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });

    return (
        <li className="flex items-start gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    {failed ? (
                        <Warning weight="fill" className="h-3 w-3 flex-shrink-0 text-warning-ink" />
                    ) : (
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                    )}
                    <span className="text-2xs font-medium text-foreground">
                        {failed ? t("panel.failedAt", { when }) : when}
                    </span>
                </div>

                {message.template ? (
                    <>
                        <p className="mt-0.5 text-2xs font-medium text-foreground">
                            {t("panel.template", { name: message.template.name })}
                        </p>
                        {message.template.preview ? (
                            <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-2xs text-muted-foreground">
                                {message.template.preview}
                            </p>
                        ) : null}
                    </>
                ) : (
                    <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-2xs text-muted-foreground">
                        {message.text || t("panel.mediaOnly")}
                    </p>
                )}

                {failureCopy ? (
                    <p className="mt-1 text-2xs text-warning-ink">{failureCopy}</p>
                ) : null}
            </div>

            {failed ? (
                canManage ? (
                    <button
                        type="button"
                        onClick={() => onReuse(message)}
                        className="flex-shrink-0 rounded-[--radius] px-2 py-1 text-2xs font-medium text-primary-ink transition-colors hover:bg-muted"
                    >
                        {t("panel.reuse")}
                    </button>
                ) : null
            ) : canManage && message.status === "pending" ? (
                <button
                    type="button"
                    onClick={() => onCancel(message.id)}
                    disabled={cancelling}
                    aria-label={t("panel.cancel")}
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive-ink disabled:opacity-40"
                >
                    <Trash weight="bold" className="h-3 w-3" />
                </button>
            ) : null}
        </li>
    );
}
