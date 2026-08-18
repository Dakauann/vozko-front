"use client";

/**
 * Compact agent simulator: the simplified in-context variant of the full
 * /agents/[id]/simulator page, mounted beside the edit form so the tune-test
 * loop never leaves the page. Same engine (useSimulatorSession — transcript,
 * sandboxed turns, session memories, retry), deliberately smaller shell: no
 * inspector rail; tool calls expand inline instead.
 *
 * It tests the LAST SAVED version of the agent (the endpoint loads from the
 * database) and says so in its hint — unsaved form edits are not simulated.
 */

import {
    ArrowCounterClockwise,
    ArrowSquareOut,
    CaretDown,
    Check,
    PaperPlaneRight,
    ShieldCheck,
    Sparkle,
    TestTube,
    Wrench,
    X,
} from "@/components/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimulatedToolCall } from "@/lib/agent-simulator/types";
import type { AgentToolDefinition } from "@/lib/agents/types";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { getAgentToolsAction } from "@/app/actions/agents";
import { useReducedMotion } from "framer-motion";
import { useSimulatorSession } from "@/lib/agent-simulator/use-simulator-session";
import { useTranslations } from "next-intl";

interface AgentSimulatorPanelProps {
    agentId: string;
    agentName: string;
}

export default function AgentSimulatorPanel({ agentId, agentName }: AgentSimulatorPanelProps) {
    const t = useTranslations("agentSimulator");
    const { session, pending, error, failedMessage, send, retry, reset } = useSimulatorSession(
        agentId,
        { genericErrorMessage: t("errors.generic") },
    );

    const [input, setInput] = useState("");
    const [confirmingReset, setConfirmingReset] = useState(false);
    const [toolCatalog, setToolCatalog] = useState<AgentToolDefinition[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const reduceMotion = useReducedMotion();

    // Display names only; a failed catalog fetch degrades to raw tool names.
    useEffect(() => {
        let cancelled = false;
        getAgentToolsAction().then(({ tools }) => {
            if (!cancelled) setToolCatalog(tools ?? []);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const displayNames = useMemo(() => {
        const map = new Map<string, string>();
        for (const def of toolCatalog) map.set(def.name, def.displayName || def.name);
        return map;
    }, [toolCatalog]);

    const { transcript } = session;

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        if (typeof el.scrollTo === "function") {
            el.scrollTo({ top: el.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
        } else {
            el.scrollTop = el.scrollHeight;
        }
    }, [transcript.length, pending, reduceMotion]);

    const submit = useCallback(() => {
        const message = input;
        if (!message.trim() || pending) return;
        setInput("");
        void send(message).then((ok) => {
            if (ok) textareaRef.current?.focus();
        });
    }, [input, pending, send]);

    return (
        // flex-1, not h-full: the host drawer stacks a close bar above this
        // panel, and a 100%-height child would overflow past the viewport by
        // exactly that bar's height (composer pushed off-screen).
        <div className="flex min-h-0 flex-1 flex-col bg-card">
            {/* Header */}
            <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[--radius] border border-border bg-muted">
                    <TestTube className="h-3.5 w-3.5 text-primary-ink" weight="bold" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">
                        {t("panel.title", { agent: agentName })}
                    </p>
                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <ShieldCheck className="h-3 w-3 shrink-0 text-healthy-ink" weight="bold" />
                        {t("panel.hint")}
                    </p>
                </div>
                {confirmingReset ? (
                    <span className="flex items-center gap-0.5">
                        <button
                            type="button"
                            onClick={() => {
                                reset();
                                setConfirmingReset(false);
                            }}
                            aria-label={t("resetConfirmYes")}
                            className="flex h-7 w-7 max-sm:h-[34px] max-sm:w-[34px] items-center justify-center rounded-[--radius] text-destructive-ink transition-colors duration-DEFAULT hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <Check className="h-3.5 w-3.5" weight="bold" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirmingReset(false)}
                            aria-label={t("resetConfirmNo")}
                            className="flex h-7 w-7 max-sm:h-[34px] max-sm:w-[34px] items-center justify-center rounded-[--radius] text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <X className="h-3.5 w-3.5" weight="bold" />
                        </button>
                    </span>
                ) : (
                    <button
                        type="button"
                        onClick={() => transcript.length > 0 && setConfirmingReset(true)}
                        disabled={transcript.length === 0}
                        aria-label={t("reset")}
                        className="flex h-7 w-7 max-sm:h-[34px] max-sm:w-[34px] items-center justify-center rounded-[--radius] text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <ArrowCounterClockwise className="h-3.5 w-3.5" weight="bold" />
                    </button>
                )}
                <Link
                    href={`/dashboard/agents/${agentId}/simulator`}
                    aria-label={t("panel.openFull")}
                    title={t("panel.openFull")}
                    className="flex h-7 w-7 max-sm:h-[34px] max-sm:w-[34px] items-center justify-center rounded-[--radius] text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <ArrowSquareOut className="h-3.5 w-3.5" weight="bold" />
                </Link>
            </div>

            {/* Transcript */}
            <div
                ref={scrollRef}
                role="log"
                aria-live="polite"
                aria-label={t("transcriptLabel")}
                className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
            >
                {transcript.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                        <Sparkle className="h-5 w-5 text-muted-foreground" weight="regular" />
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            {t("panel.empty")}
                        </p>
                    </div>
                ) : (
                    <ol className="flex flex-col gap-2">
                        {transcript.map((item) => (
                            <li key={item.id}>
                                {item.kind === "user" && (
                                    <div className="flex justify-end">
                                        <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs leading-relaxed text-foreground">
                                            {item.content}
                                        </div>
                                    </div>
                                )}
                                {item.kind === "agent" && (
                                    <div className="flex justify-start">
                                        <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs leading-relaxed text-foreground shadow-sm">
                                            {item.content}
                                        </div>
                                    </div>
                                )}
                                {item.kind === "tool" && (
                                    <CompactToolRow
                                        call={item.call}
                                        displayName={displayNames.get(item.call.name) ?? item.call.name}
                                    />
                                )}
                            </li>
                        ))}
                        {pending && (
                            <li>
                                <span
                                    role="status"
                                    aria-label={t("typing")}
                                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-2 shadow-sm"
                                >
                                    {[0, 1, 2].map((i) => (
                                        <span
                                            key={i}
                                            className="h-1.5 w-1.5 animate-dot-pulse rounded-full bg-muted-foreground/60"
                                            style={{ animationDelay: `${i * 150}ms` }}
                                        />
                                    ))}
                                </span>
                            </li>
                        )}
                    </ol>
                )}
            </div>

            {/* Composer */}
            <div className="shrink-0 border-t border-border px-3 pb-2 pt-2">
                {error && (
                    <div className="mb-2 flex items-start justify-between gap-2 rounded-lg border border-border border-t-destructive/60 bg-muted px-2.5 py-1.5">
                        <p className="min-w-0 break-words text-[11px] leading-relaxed text-destructive-ink">
                            {error}
                        </p>
                        {failedMessage && (
                            <button
                                type="button"
                                onClick={retry}
                                className="shrink-0 rounded-[--radius] px-1.5 py-0.5 text-[11px] font-semibold text-primary-ink transition-colors duration-DEFAULT hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {t("retry")}
                            </button>
                        )}
                    </div>
                )}
                <div className="flex items-end gap-1.5 rounded-lg border border-border bg-muted p-1.5 focus-within:ring-2 focus-within:ring-ring">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                submit();
                            }
                        }}
                        placeholder={t("composerPlaceholder")}
                        rows={Math.min(4, Math.max(1, input.split("\n").length))}
                        disabled={pending}
                        className="max-h-28 min-h-8 w-full resize-none bg-transparent px-1.5 py-1 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
                    />
                    <button
                        type="button"
                        onClick={submit}
                        disabled={pending || input.trim() === ""}
                        aria-label={t("send")}
                        className="flex h-7 w-7 max-sm:h-[34px] max-sm:w-[34px] shrink-0 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground shadow-button transition-colors duration-DEFAULT hover:bg-primary-hover active:bg-primary-active disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <PaperPlaneRight className="h-3.5 w-3.5" weight="fill" />
                    </button>
                </div>
                <p className="mt-1 text-center text-[10px] text-muted-foreground">
                    {t("composerHint")}
                </p>
            </div>
        </div>
    );
}

/** No rail here, so the tool call carries its own disclosure. */
function CompactToolRow({
    call,
    displayName,
}: {
    call: SimulatedToolCall;
    displayName: string;
}) {
    const t = useTranslations("agentSimulator");
    const [open, setOpen] = useState(false);
    const hasArguments = Object.keys(call.arguments ?? {}).length > 0;

    return (
        <div className="rounded-[--radius] border border-dashed border-border-strong bg-card">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                className="flex w-full max-sm:min-h-[34px] items-center gap-1.5 px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <Wrench
                    className={cn(
                        "h-3 w-3 shrink-0",
                        call.isError ? "text-destructive-ink" : "text-info-ink",
                    )}
                    weight="bold"
                />
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
                    {displayName}
                </span>
                <span
                    className={cn(
                        "text-[10px] font-semibold",
                        call.isError
                            ? "text-destructive-ink"
                            : call.stubbed
                              ? "text-muted-foreground"
                              : "text-healthy-ink",
                    )}
                >
                    {call.isError
                        ? t("tool.refused")
                        : call.stubbed
                          ? t("tool.simulated")
                          : t("tool.executed")}
                </span>
                <CaretDown
                    className={cn(
                        "h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-DEFAULT",
                        open && "rotate-180",
                    )}
                    weight="bold"
                />
            </button>
            {open && (
                <div className="flex flex-col gap-1.5 border-t border-border px-2 py-1.5">
                    {hasArguments ? (
                        <pre className="readout max-h-32 overflow-auto rounded-[--radius] border border-border bg-muted px-2 py-1.5 font-mono text-[10px] leading-relaxed text-foreground">
                            {JSON.stringify(call.arguments, null, 2)}
                        </pre>
                    ) : (
                        <p className="text-[10px] text-muted-foreground">{t("rail.noArguments")}</p>
                    )}
                    {call.result && (
                        <p
                            className={cn(
                                "whitespace-pre-wrap break-words text-[10px] leading-relaxed",
                                call.isError ? "text-destructive-ink" : "text-muted-foreground",
                            )}
                        >
                            {call.result}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
