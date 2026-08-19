"use client";

import type { ScheduledMessage } from "@/lib/scheduled-messages/types";
import { CaretDown, Clock, Trash, Warning } from "@/components/icons";
import { useCallback, useMemo, useState } from "react";

import { cancelScheduledMessageAction } from "@/app/actions/scheduled-messages";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface ScheduledMessagesPanelProps {
    messages: ScheduledMessage[];
    /** Cancel is a send-shaped action, so it follows the composer's permission. */
    canManage: boolean;
    onChanged: () => void;
    /** Re-opens the composer with this message's content, for a one-click resend. */
    onReuse: (message: ScheduledMessage) => void;
}

/**
 * The conversation's scheduled queue, above the composer.
 *
 * Shows what has not gone out yet and what failed. Delivered messages are
 * deliberately absent: they are already in the conversation above, and listing
 * them twice would make the panel a second, worse message history.
 */
export default function ScheduledMessagesPanel({
    messages,
    canManage,
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
            // Refetch rather than optimistically removing: a cancel can LOSE the
            // race with the dispatcher, and pretending otherwise would hide a
            // message the customer just received.
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
                                canManage={canManage}
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

    // `dispatch_interrupted` is NOT a plain failure: the message may have been
    // delivered and we simply could not confirm it. Its copy sends the operator
    // to look at the conversation rather than to send again blind.
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

                <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-2xs text-muted-foreground">
                    {message.text || t("panel.mediaOnly")}
                </p>

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
