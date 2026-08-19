"use client";

import { Checks } from "@/components/icons";
import TemplateBubble from "@/components/crm/TemplateBubble";
import type { TemplateMessageMetadata } from "@/lib/conversations/types";
import { cn } from "@/lib/utils";

/**
 * The template as it will land in the inbox, drawn the way the inbox draws it.
 *
 * The point is not "here is your text". The point is that this message will
 * interrupt somebody who never wrote to you, and the operator is about to pay
 * for that. Seeing it as a bubble on the sent side, under two messages that are
 * not theirs, is what makes that concrete — a paragraph in a panel does not.
 *
 * Every geometry and fill here is lifted from CrmConversationView's real message
 * rows, not approximated: same radius and same clipped corner per side, same
 * padding, same 75% ceiling, same fills, and the template nested INSIDE the sent
 * bubble exactly as the thread nests it. When those change, this must change
 * with them — a preview that quietly drifts from the thread is worse than none,
 * because it is believed.
 *
 * The incoming bubbles are deliberately wordless. Filling them with invented
 * dialogue would put sentences in a real customer's mouth and imply a history
 * this contact does not have.
 */
export function TemplateConversationPreview({
    metadata,
    className,
    dateLabel,
    emptyLabel,
    withHistory = true,
}: {
    metadata: TemplateMessageMetadata | null;
    className?: string;
    /** The date separator's text, e.g. "Hoje". */
    dateLabel?: string;
    /** Shown in the sent slot before there is anything to send. */
    emptyLabel?: string;
    withHistory?: boolean;
}) {
    return (
        <div
            className={cn(
                // The app canvas, not a wallpaper. The real thread has no ground
                // of its own — it sits on the same cool canvas as everything
                // else, and only the BUBBLES carry colour. Reversing that (a
                // tinted panel behind neutral bubbles) is what made an earlier
                // version of this read as a quotation block rather than a chat.
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
                            // The sent side, verbatim from the thread: the clipped
                            // top-right corner is what tells you which end of the
                            // conversation you are looking at before you read a word.
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

/** The thread's date pill, so the run of bubbles reads as a day, not a list. */
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

/**
 * One of the other person's messages.
 *
 * `firstOfRun` keeps the clipped corner on the first bubble of a run only, which
 * is the rule the thread itself follows — consecutive messages from one side
 * square up against each other so the run reads as one turn.
 */
function ReceivedBubble({
    width,
    lines,
    firstOfRun = false,
}: {
    /** Share of the thread's width this message occupies. */
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
                // The width belongs to the BUBBLE, not to the lines inside it.
                // Sizing the lines as a percentage of a bubble that shrink-wraps
                // to those same lines is circular, and the browser resolves it by
                // collapsing both — which is why these read as chips rather than
                // messages.
                style={{ width }}
            >
                {Array.from({ length: lines }).map((_, index) => (
                    <span
                        key={index}
                        className={cn(
                            "block h-2 rounded-full bg-muted-foreground/25",
                            // The last line stops short, the way a sentence does.
                            index === lines - 1 && lines > 1 ? "w-2/3" : "w-full",
                        )}
                        aria-hidden
                    />
                ))}
            </div>
        </div>
    );
}

/**
 * Time and delivery ticks.
 *
 * Small, and load-bearing: the ticks are the mark the thread uses for "this one
 * is ours and it left". Without them a right-aligned bubble is just a bubble
 * that drifted to the wrong side.
 */
function MessageStamp() {
    return (
        <span className="mt-0.5 flex items-center justify-end gap-1 text-2xs text-muted-foreground">
            <span className="readout">--:--</span>
            <Checks className="h-3 w-3 text-info-ink/60" weight="bold" aria-hidden />
        </span>
    );
}
