"use client";

import { Checks } from "@/components/icons";
import TemplateBubble from "@/components/crm/TemplateBubble";
import type { TemplateMessageMetadata } from "@/lib/conversations/types";
import { cn } from "@/lib/utils";

export function TemplateConversationPreview({
    metadata,
    className,
    dateLabel,
    emptyLabel,
    withHistory = true,
}: {
    metadata: TemplateMessageMetadata | null;
    className?: string;
    dateLabel?: string;
    emptyLabel?: string;
    withHistory?: boolean;
}) {
    return (
        <div
            className={cn(
                "flex flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-background px-3 py-3",
                className,
            )}
            role="img"
            aria-label={emptyLabel ?? "preview"}
        >
            {withHistory && (
                <>
                    <DateSeparator label={dateLabel} />
                    <ReceivedBubble width="72%" lines={2} firstOfRun />
                    <ReceivedBubble width="54%" lines={1} />
                </>
            )}

            <div className={cn("flex justify-end", withHistory && "pt-2")}>
                {metadata ? (
                    <div
                        className={cn(
                            "relative max-w-[85%] rounded-[--radius] rounded-tr-sm px-3 py-2 shadow-sm",
                            "bg-[#d9fdd3] text-foreground dark:bg-[#005c4b] dark:text-slate-100",
                        )}
                    >
                        <TemplateBubble metadata={metadata} />
                        <MessageStamp />
                    </div>
                ) : (
                    <div className="max-w-[75%] rounded-[--radius] rounded-tr-sm border border-dashed border-border px-4 py-5 text-xs text-muted-foreground">
                        {emptyLabel}
                    </div>
                )}
            </div>
        </div>
    );
}

function DateSeparator({ label }: { label?: string }) {
    if (!label) return null;
    return (
        <div className="flex justify-center pb-1">
            <span className="rounded-lg bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
                {label}
            </span>
        </div>
    );
}

function ReceivedBubble({
    width,
    lines,
    firstOfRun = false,
}: {
    width: string;
    lines: number;
    firstOfRun?: boolean;
}) {
    return (
        <div className="flex justify-start">
            <div
                className={cn(
                    "space-y-1.5 rounded-[--radius] px-3 py-2.5 shadow-sm",
                    "bg-card dark:bg-[#202c33]",
                    firstOfRun ? "rounded-tl-sm" : "rounded-tl-sm rounded-bl-sm",
                )}
                style={{ width }}
            >
                {Array.from({ length: lines }).map((_, index) => (
                    <span
                        key={index}
                        className={cn(
                            "block h-2 rounded-full bg-muted-foreground/25",
                            index === lines - 1 && lines > 1 ? "w-2/3" : "w-full",
                        )}
                        aria-hidden
                    />
                ))}
            </div>
        </div>
    );
}

function MessageStamp() {
    return (
        <span className="mt-0.5 flex items-center justify-end gap-1 text-2xs text-muted-foreground">
            <span className="readout">--:--</span>
            <Checks className="h-3 w-3 text-info-ink/60" weight="bold" aria-hidden />
        </span>
    );
}
