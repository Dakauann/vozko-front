"use client";

/**
 * Agent simulator: an Operate surface inside the "Surface" world.
 *
 * THESIS: a split-view instrument. The left half is the conversation exactly
 * as a lead would live it (segmented bubbles, typing pulse, channel realism);
 * the right half is the X-ray of the turn that produced it (tool calls with
 * the model's own arguments, the assembled prompt, memory/RAG flags, token
 * cost). What a consumer chat hides is this page's first-class content,
 * because the visitor is not chatting, they are debugging. Tool calls also
 * appear inline in the transcript, at the exact position they fired: the
 * conversation stays the source of truth and the rail is its magnifier.
 * Refused: a debug modal, JSON crammed into chat bubbles, dashboard cards.
 */

import {
    ArrowCounterClockwise,
    ArrowLeft,
    CaretDown,
    Check,
    MagnifyingGlass,
    PaperPlaneRight,
    ShieldCheck,
    Sparkle,
    TestTube,
    UserCircle,
    Wrench,
    X,
} from "@/components/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimulatedToolCall, TurnRecord } from "@/lib/agent-simulator/types";
import type { Agent, AgentToolDefinition } from "@/lib/agents/types";
import {
    type LeadContext,
    useSimulatorSession,
} from "@/lib/agent-simulator/use-simulator-session";

import CrmSegmentedToggle from "@/components/crm/CrmSegmentedToggle";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { listLeadsAction } from "@/app/actions/leads";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

interface SimulatorClientProps {
    agent: Agent;
    toolCatalog: AgentToolDefinition[];
}

type RailTab = "tools" | "xray";

export default function SimulatorClient({ agent, toolCatalog }: SimulatorClientProps) {
    const t = useTranslations("agentSimulator");

    // The conversation engine (transcript, turns, session memories, lead,
    // retry semantics) is the shared hook: the edit-page panel runs the exact
    // same logic, so the two surfaces cannot drift.
    const {
        session,
        pending,
        error,
        failedMessage,
        send,
        retry,
        reset: resetSession,
        setLeadContext: setLeadContextRaw,
    } = useSimulatorSession(agent.id, { genericErrorMessage: t("errors.generic") });

    const [input, setInput] = useState("");
    const [railTab, setRailTab] = useState<RailTab>("tools");
    const [railOpenMobile, setRailOpenMobile] = useState(false);
    const [focusedToolId, setFocusedToolId] = useState<string | null>(null);
    const [confirmingReset, setConfirmingReset] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [atBottom, setAtBottom] = useState(true);

    const displayNames = useMemo(() => {
        const map = new Map<string, string>();
        for (const def of toolCatalog) map.set(def.name, def.displayName || def.name);
        return map;
    }, [toolCatalog]);

    const { transcript, turns } = session;
    const toolCallCount = useMemo(
        () => transcript.filter((item) => item.kind === "tool").length,
        [transcript],
    );
    const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null;

    const reduceMotion = useReducedMotion();

    const scrollToBottom = useCallback(
        (behavior: ScrollBehavior = "smooth") => {
            const el = scrollRef.current;
            if (!el) return;
            if (typeof el.scrollTo === "function") {
                el.scrollTo({ top: el.scrollHeight, behavior: reduceMotion ? "auto" : behavior });
            } else {
                el.scrollTop = el.scrollHeight;
            }
        },
        [reduceMotion],
    );

    useEffect(() => {
        if (atBottom) scrollToBottom(transcript.length <= 2 ? "auto" : "smooth");
    }, [transcript.length, pending, atBottom, scrollToBottom]);

    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 48);
    }, []);

    const submit = useCallback(() => {
        const message = input;
        if (!message.trim() || pending) return;
        setInput("");
        void send(message).then((ok) => {
            if (ok) textareaRef.current?.focus();
        });
    }, [input, pending, send]);

    const setLeadContext = useCallback(
        (lead: LeadContext | null) => {
            setLeadContextRaw(lead);
            setFocusedToolId(null);
            textareaRef.current?.focus();
        },
        [setLeadContextRaw],
    );

    const reset = useCallback(() => {
        resetSession();
        setFocusedToolId(null);
        setConfirmingReset(false);
        textareaRef.current?.focus();
    }, [resetSession]);

    const focusToolCall = useCallback((id: string) => {
        setRailTab("tools");
        setRailOpenMobile(true);
        setFocusedToolId(id);
    }, []);

    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
            }
        },
        [submit],
    );

    return (
        <div className="-m-3 flex h-[calc(100dvh-3rem)] flex-col overflow-hidden border-y border-border bg-card sm:-m-6">
            {/* ── Instrument header ────────────────────────────────────────── */}
            <header className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-2 sm:px-4">
                <Link
                    href={`/dashboard/agents/${agent.id}`}
                    aria-label={t("backToAgent")}
                    className="flex h-8 w-8 max-sm:h-[34px] max-sm:w-[34px] shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <ArrowLeft className="h-4 w-4" weight="bold" />
                </Link>

                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                    <TestTube className="h-4 w-4 text-primary-ink" weight="bold" />
                </span>

                <div className="min-w-0">
                    <h1 className="truncate text-sm font-semibold tracking-[-0.01em] text-foreground">
                        {t("title", { agent: agent.name })}
                    </h1>
                    <p className="readout truncate text-[11px] text-muted-foreground">
                        {agent.messagingModel}
                    </p>
                </div>

                {/* The sandbox promise, always on screen: this page's one claim. */}
                <span className="ml-2 hidden items-center gap-1.5 rounded-[--radius] border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground md:inline-flex">
                    <ShieldCheck className="h-3.5 w-3.5 text-healthy-ink" weight="bold" />
                    {t("sandboxBadge")}
                </span>

                <div className="ml-auto flex items-center gap-1">
                    <LeadContextPicker
                        lead={session.lead}
                        hasTranscript={transcript.length > 0}
                        onChange={setLeadContext}
                    />
                    {confirmingReset ? (
                        <span className="flex items-center gap-1 rounded-[--radius] border border-border bg-muted px-1 py-0.5">
                            <span className="px-1.5 text-[11px] font-medium text-foreground">
                                {t("resetConfirm")}
                            </span>
                            <button
                                type="button"
                                onClick={reset}
                                aria-label={t("resetConfirmYes")}
                                className="flex h-6 w-6 max-sm:h-[34px] max-sm:w-[34px] items-center justify-center rounded-[--radius] text-destructive-ink transition-colors duration-DEFAULT hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <Check className="h-3.5 w-3.5" weight="bold" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setConfirmingReset(false)}
                                aria-label={t("resetConfirmNo")}
                                className="flex h-6 w-6 max-sm:h-[34px] max-sm:w-[34px] items-center justify-center rounded-[--radius] text-muted-foreground transition-colors duration-DEFAULT hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <X className="h-3.5 w-3.5" weight="bold" />
                            </button>
                        </span>
                    ) : (
                        <button
                            type="button"
                            onClick={() => transcript.length > 0 && setConfirmingReset(true)}
                            disabled={transcript.length === 0}
                            className="inline-flex h-8 max-sm:min-h-[34px] items-center gap-1.5 rounded-[--radius] px-2.5 text-xs font-medium text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <ArrowCounterClockwise className="h-3.5 w-3.5" weight="bold" />
                            <span className="hidden sm:inline">{t("reset")}</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setRailOpenMobile(true)}
                        className="relative inline-flex h-8 max-sm:min-h-[34px] items-center gap-1.5 rounded-[--radius] px-2.5 text-xs font-medium text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
                    >
                        <Wrench className="h-3.5 w-3.5" weight="bold" />
                        {t("rail.open")}
                        {toolCallCount > 0 && (
                            <span className="readout rounded-full bg-muted px-1.5 text-[10px] font-semibold text-foreground">
                                {toolCallCount}
                            </span>
                        )}
                    </button>
                </div>
            </header>

            {/* ── Split view ───────────────────────────────────────────────── */}
            <div className="flex min-h-0 flex-1">
                {/* Conversation */}
                <section className="relative flex min-w-0 flex-1 flex-col">
                    <div
                        ref={scrollRef}
                        onScroll={handleScroll}
                        role="log"
                        aria-live="polite"
                        aria-label={t("transcriptLabel")}
                        className="min-h-0 flex-1 overflow-y-auto"
                    >
                        <div className="mx-auto w-full max-w-2xl px-4 py-6">
                            {transcript.length === 0 ? (
                                <EmptyState agentName={agent.name} leadName={session.lead?.name ?? null} />
                            ) : (
                                <ol className="flex flex-col gap-3">
                                    {transcript.map((item) => (
                                        <li key={item.id}>
                                            {item.kind === "user" && (
                                                <div className="flex justify-end">
                                                    <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-lg border border-border bg-muted px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
                                                        {item.content}
                                                    </div>
                                                </div>
                                            )}
                                            {item.kind === "agent" && (
                                                <div className="flex items-start gap-2.5">
                                                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[--radius] border border-border bg-muted">
                                                        <Sparkle className="h-3.5 w-3.5 text-primary-ink" weight="bold" />
                                                    </span>
                                                    <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm leading-relaxed text-foreground shadow-sm">
                                                        {item.content}
                                                    </div>
                                                </div>
                                            )}
                                            {item.kind === "tool" && (
                                                <InlineToolRow
                                                    call={item.call}
                                                    displayName={displayNames.get(item.call.name) ?? item.call.name}
                                                    onInspect={() => focusToolCall(item.id)}
                                                />
                                            )}
                                        </li>
                                    ))}
                                    {pending && (
                                        <li className="flex items-start gap-2.5">
                                            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[--radius] border border-border bg-muted">
                                                <Sparkle className="h-3.5 w-3.5 text-primary-ink" weight="bold" />
                                            </span>
                                            <span
                                                role="status"
                                                className="flex items-center gap-1 rounded-lg border border-border bg-card px-3.5 py-3 shadow-sm"
                                                aria-label={t("typing")}
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
                    </div>

                    {/* Composer */}
                    <div className="relative shrink-0 border-t border-border px-4 pb-3 pt-3">
                        {!atBottom && transcript.length > 0 && (
                            <button
                                type="button"
                                onClick={() => scrollToBottom()}
                                aria-label={t("jumpToLatest")}
                                className="absolute -top-11 left-1/2 z-10 flex h-8 w-8 max-sm:h-[34px] max-sm:w-[34px] -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-colors duration-DEFAULT hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <CaretDown className="h-4 w-4" weight="bold" />
                            </button>
                        )}

                        <div className="mx-auto w-full max-w-2xl">
                            {error && (
                                <div className="mb-2 flex items-start justify-between gap-3 rounded-lg border border-border border-t-destructive/60 bg-muted px-3 py-2">
                                    <p className="min-w-0 break-words text-xs leading-relaxed text-destructive-ink">
                                        {error}
                                    </p>
                                    {failedMessage && (
                                        <button
                                            type="button"
                                            onClick={retry}
                                            className="shrink-0 rounded-[--radius] px-2 py-1 text-xs font-semibold text-primary-ink transition-colors duration-DEFAULT hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            {t("retry")}
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="flex items-end gap-2 rounded-lg border border-border bg-muted p-2 focus-within:ring-2 focus-within:ring-ring">
                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={(event) => setInput(event.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={t("composerPlaceholder")}
                                    rows={Math.min(5, Math.max(1, input.split("\n").length))}
                                    disabled={pending}
                                    autoFocus
                                    className="max-h-40 min-h-9 w-full resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
                                />
                                <button
                                    type="button"
                                    onClick={submit}
                                    disabled={pending || input.trim() === ""}
                                    aria-label={t("send")}
                                    className="flex h-8 w-8 max-sm:h-[34px] max-sm:w-[34px] shrink-0 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground shadow-button transition-colors duration-DEFAULT hover:bg-primary-hover active:bg-primary-active disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <PaperPlaneRight className="h-4 w-4" weight="fill" />
                                </button>
                            </div>
                            <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
                                {t("composerHint")}
                            </p>
                        </div>
                    </div>
                </section>

                {/* Inspector rail (desktop inline / mobile slide-over) */}
                <InspectorRail
                    tab={railTab}
                    onTabChange={setRailTab}
                    turns={turns}
                    lastTurn={lastTurn}
                    toolCallCount={toolCallCount}
                    displayNames={displayNames}
                    focusedToolId={focusedToolId}
                    openMobile={railOpenMobile}
                    onCloseMobile={() => setRailOpenMobile(false)}
                />
            </div>
        </div>
    );
}

/* ── Pieces ──────────────────────────────────────────────────────────────── */

function EmptyState({ agentName, leadName }: { agentName: string; leadName: string | null }) {
    const t = useTranslations("agentSimulator");
    return (
        <div className="flex flex-col items-center gap-3 px-6 pb-10 pt-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted">
                <TestTube className="h-6 w-6 text-primary-ink" weight="bold" />
            </span>
            <h2 className="text-base font-semibold tracking-[-0.01em] text-foreground">
                {t("empty.title", { agent: agentName })}
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                {t("empty.description")}
            </p>
            {leadName ? (
                <p className="flex items-center gap-1.5 rounded-[--radius] border border-border bg-muted px-2.5 py-1 text-[11px] text-foreground">
                    <UserCircle className="h-3.5 w-3.5 text-info-ink" weight="bold" />
                    {t("empty.asLead", { lead: leadName })}
                </p>
            ) : null}
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-healthy-ink" weight="bold" />
                {t("empty.sandboxNote")}
            </p>
        </div>
    );
}

function LeadContextPicker({
    lead,
    hasTranscript,
    onChange,
}: {
    lead: LeadContext | null;
    hasTranscript: boolean;
    onChange: (lead: LeadContext | null) => void;
}) {
    const t = useTranslations("agentSimulator");
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<LeadContext[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState(false);
    const [confirmingClear, setConfirmingClear] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    // Close on outside click: a popover this small earns no portal machinery.
    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: PointerEvent) => {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        // Escape closes and hands focus back to the trigger.
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setOpen(false);
                triggerRef.current?.focus();
            }
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    // Debounced search over the workspace's leads. The searching indicator
    // flips inside the timeout so the effect body stays setState-free.
    useEffect(() => {
        if (!open) return;
        const trimmed = query.trim();
        const handle = setTimeout(async () => {
            setSearching(true);
            const { leads, error } = await listLeadsAction({
                name: trimmed || undefined,
                pageSize: 8,
                sort: "createdAt",
                order: "desc",
            });
            // A failed search must not read as "no leads found".
            setSearchError(Boolean(error));
            setResults(
                leads.map((item) => ({
                    id: item.id,
                    name: item.name?.trim() ? item.name : item.number,
                })),
            );
            setSearching(false);
        }, 250);
        return () => clearTimeout(handle);
    }, [open, query]);

    const pick = (next: LeadContext | null) => {
        setOpen(false);
        setQuery("");
        setConfirmingClear(false);
        onChange(next);
    };

    // Clearing the lead destroys the transcript exactly like Reset does, so it
    // earns the same inline confirm, but only when there is anything to lose.
    const requestClear = () => {
        if (hasTranscript) {
            setConfirmingClear(true);
        } else {
            pick(null);
        }
    };

    return (
        <div ref={rootRef} className="relative">
            {lead ? (
                <span className="inline-flex h-8 max-sm:h-9 items-center gap-1.5 rounded-[--radius] border border-border bg-muted pl-2.5 pr-1 text-xs font-medium text-foreground">
                    <UserCircle className="h-3.5 w-3.5 shrink-0 text-info-ink" weight="bold" />
                    <span className="max-w-32 truncate">{lead.name}</span>
                    {confirmingClear ? (
                        // Clearing the lead destroys the transcript exactly like
                        // Reset does: same inline confirm, same anatomy.
                        <>
                            <span className="pl-1 text-[11px] font-medium text-foreground">
                                {t("resetConfirm")}
                            </span>
                            <button
                                type="button"
                                onClick={() => pick(null)}
                                aria-label={t("resetConfirmYes")}
                                className="flex h-6 w-6 max-sm:h-[34px] max-sm:w-[34px] items-center justify-center rounded-full text-destructive-ink transition-colors duration-DEFAULT hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <Check className="h-3 w-3" weight="bold" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setConfirmingClear(false)}
                                aria-label={t("resetConfirmNo")}
                                className="flex h-6 w-6 max-sm:h-[34px] max-sm:w-[34px] items-center justify-center rounded-full text-muted-foreground transition-colors duration-DEFAULT hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <X className="h-3 w-3" weight="bold" />
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={requestClear}
                            aria-label={t("leadPicker.clear")}
                            className="flex h-6 w-6 max-sm:h-[34px] max-sm:w-[34px] items-center justify-center rounded-full text-muted-foreground transition-colors duration-DEFAULT hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <X className="h-3 w-3" weight="bold" />
                        </button>
                    )}
                </span>
            ) : (
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={() => setOpen((value) => !value)}
                    aria-expanded={open}
                    className="inline-flex h-8 max-sm:min-h-[34px] items-center gap-1.5 rounded-[--radius] px-2.5 text-xs font-medium text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <UserCircle className="h-3.5 w-3.5" weight="bold" />
                    <span className="hidden sm:inline">{t("leadPicker.button")}</span>
                </button>
            )}

            {open && !lead && (
                <div className="absolute right-0 top-10 z-30 w-72 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                    <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                        <MagnifyingGlass className="h-3.5 w-3.5 shrink-0 text-muted-foreground" weight="bold" />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={t("leadPicker.searchPlaceholder")}
                            autoFocus
                            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                        />
                    </div>
                    {hasTranscript && (
                        <p className="border-b border-border bg-muted px-3 py-1.5 text-[11px] text-muted-foreground">
                            {t("leadPicker.resetWarning")}
                        </p>
                    )}
                    <ul className="max-h-64 overflow-y-auto p-1">
                        {searching ? (
                            <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                                {t("leadPicker.searching")}
                            </li>
                        ) : searchError ? (
                            <li className="px-2 py-3 text-center text-xs text-destructive-ink">
                                {t("leadPicker.searchError")}
                            </li>
                        ) : results.length === 0 ? (
                            <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                                {t("leadPicker.noResults")}
                            </li>
                        ) : (
                            results.map((item) => (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        onClick={() => pick(item)}
                                        className="flex h-[30px] max-sm:min-h-[34px] w-full items-center gap-2 rounded-[--radius] px-2 text-left text-sm text-foreground transition-colors duration-DEFAULT hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <UserCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" weight="bold" />
                                        <span className="truncate">{item.name}</span>
                                    </button>
                                </li>
                            ))
                        )}
                    </ul>
                    <p className="border-t border-border px-3 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        {t("leadPicker.hint")}
                    </p>
                </div>
            )}
        </div>
    );
}

function InlineToolRow({
    call,
    displayName,
    onInspect,
}: {
    call: SimulatedToolCall;
    displayName: string;
    onInspect: () => void;
}) {
    const t = useTranslations("agentSimulator");
    return (
        <div className="flex pl-9">
            <button
                type="button"
                onClick={onInspect}
                className="group inline-flex max-w-full max-sm:min-h-[34px] items-center gap-2 rounded-[--radius] border border-dashed border-border-strong bg-card px-2.5 py-1.5 text-left transition-colors duration-DEFAULT hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <Wrench
                    className={cn("h-3.5 w-3.5 shrink-0", call.isError ? "text-destructive-ink" : "text-info-ink")}
                    weight="bold"
                />
                <span className="truncate text-xs font-medium text-foreground">{displayName}</span>
                <span className="readout hidden truncate text-[10px] text-muted-foreground sm:inline">
                    {call.name}
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
            </button>
        </div>
    );
}

function InspectorRail({
    tab,
    onTabChange,
    turns,
    lastTurn,
    toolCallCount,
    displayNames,
    focusedToolId,
    openMobile,
    onCloseMobile,
}: {
    tab: RailTab;
    onTabChange: (tab: RailTab) => void;
    turns: TurnRecord[];
    lastTurn: TurnRecord | null;
    toolCallCount: number;
    displayNames: Map<string, string>;
    focusedToolId: string | null;
    openMobile: boolean;
    onCloseMobile: () => void;
}) {
    const t = useTranslations("agentSimulator");
    const mobileAsideRef = useRef<HTMLElement>(null);

    // Opening the slide-over moves focus into it (first focusable control) so
    // keyboard users land where the content is.
    useEffect(() => {
        if (openMobile) {
            mobileAsideRef.current?.querySelector<HTMLElement>("button")?.focus();
        }
    }, [openMobile]);

    const body = (
        <>
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <CrmSegmentedToggle<RailTab>
                    // Icons are load-bearing: below md the toggle collapses
                    // labels to sr-only, and in the slide-over, the only rail
                    // access on phones, an iconless option would be a blank key.
                    options={[
                        {
                            value: "tools",
                            label: t("rail.tabs.tools", { count: toolCallCount }),
                            icon: <Wrench className="h-3 w-3" weight="bold" />,
                        },
                        {
                            value: "xray",
                            label: t("rail.tabs.xray"),
                            icon: <Sparkle className="h-3 w-3" weight="bold" />,
                        },
                    ]}
                    value={tab}
                    onChange={onTabChange}
                />
                <button
                    type="button"
                    onClick={onCloseMobile}
                    aria-label={t("rail.close")}
                    className="flex h-7 w-7 max-sm:h-[34px] max-sm:w-[34px] items-center justify-center rounded-[--radius] text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
                >
                    <X className="h-4 w-4" weight="bold" />
                </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-background/60">
                {tab === "tools" ? (
                    <ToolsTab turns={turns} displayNames={displayNames} focusedToolId={focusedToolId} />
                ) : (
                    <XRayTab lastTurn={lastTurn} displayNames={displayNames} />
                )}
            </div>
        </>
    );

    return (
        <>
            {/* Desktop: inline rail */}
            <aside className="hidden w-[24rem] shrink-0 flex-col border-l border-border xl:w-[26rem] lg:flex">
                {body}
            </aside>

            {/* Mobile: slide-over. `inert` keeps the closed panel's controls out
                of the tab order: aria-hidden alone would leave keyboard focus
                landing on invisible off-screen buttons. */}
            <div
                aria-hidden={!openMobile}
                inert={!openMobile}
                className={cn(
                    "fixed inset-0 z-40 lg:hidden",
                    openMobile ? "pointer-events-auto" : "pointer-events-none",
                )}
            >
                <div
                    onClick={onCloseMobile}
                    className={cn(
                        "absolute inset-0 bg-foreground/20 transition-opacity duration-200 motion-reduce:transition-none",
                        openMobile ? "opacity-100" : "opacity-0",
                    )}
                />
                <aside
                    ref={mobileAsideRef}
                    className={cn(
                        "absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-card shadow-xl transition-transform duration-200 ease-panel motion-reduce:transition-none",
                        openMobile ? "translate-x-0" : "translate-x-full",
                    )}
                >
                    {body}
                </aside>
            </div>
        </>
    );
}

function ToolsTab({
    turns,
    displayNames,
    focusedToolId,
}: {
    turns: TurnRecord[];
    displayNames: Map<string, string>;
    focusedToolId: string | null;
}) {
    const t = useTranslations("agentSimulator");

    if (turns.every((turn) => turn.toolCalls.length === 0)) {
        return (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <Wrench className="h-5 w-5 text-muted-foreground" weight="regular" />
                <p className="text-xs leading-relaxed text-muted-foreground">{t("rail.toolsEmpty")}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 px-3 py-3">
            {turns
                .filter((turn) => turn.toolCalls.length > 0)
                .map((turn) => (
                    <section key={turn.turn}>
                        <h3 className="legend mb-1.5">{t("rail.turnHeading", { turn: turn.turn })}</h3>
                        <div className="flex flex-col gap-2">
                            {turn.toolCalls.map((call, index) => (
                                <ToolCallCard
                                    key={`${turn.turn}-${index}`}
                                    call={call}
                                    displayName={displayNames.get(call.name) ?? call.name}
                                    highlighted={focusedToolId === `t-${turn.turn}-${index}`}
                                />
                            ))}
                        </div>
                    </section>
                ))}
        </div>
    );
}

function ToolCallCard({
    call,
    displayName,
    highlighted,
}: {
    call: SimulatedToolCall;
    displayName: string;
    highlighted: boolean;
}) {
    const t = useTranslations("agentSimulator");
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const reduceMotion = useReducedMotion();

    // Becoming highlighted expands the card once (the documented
    // adjust-state-on-prop-change pattern); the user may still collapse it
    // afterwards. The DOM scroll stays in an effect.
    const [prevHighlighted, setPrevHighlighted] = useState(false);
    if (highlighted !== prevHighlighted) {
        setPrevHighlighted(highlighted);
        if (highlighted && !open) setOpen(true);
    }

    useEffect(() => {
        if (highlighted) {
            ref.current?.scrollIntoView({
                behavior: reduceMotion ? "auto" : "smooth",
                block: "nearest",
            });
        }
    }, [highlighted, reduceMotion]);

    const hasArguments = Object.keys(call.arguments ?? {}).length > 0;

    return (
        <div
            ref={ref}
            className={cn(
                "rounded-lg border bg-card shadow-sm transition-colors duration-DEFAULT",
                highlighted ? "border-primary" : "border-border",
            )}
        >
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                className="flex w-full items-center gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <span
                    className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        call.isError ? "bg-destructive" : "bg-healthy",
                    )}
                />
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-foreground">{displayName}</span>
                    <span className="readout block truncate text-[10px] text-muted-foreground">{call.name}</span>
                </span>
                <CaretDown
                    className={cn(
                        "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-DEFAULT",
                        open && "rotate-180",
                    )}
                    weight="bold"
                />
            </button>

            {open && (
                <div className="flex flex-col gap-2 border-t border-border px-3 py-2.5">
                    <div>
                        <h4 className="legend mb-1">{t("rail.arguments")}</h4>
                        {hasArguments ? (
                            <pre className="readout max-h-48 overflow-auto rounded-[--radius] border border-border bg-muted px-2.5 py-2 font-mono text-[11px] leading-relaxed text-foreground">
                                {JSON.stringify(call.arguments, null, 2)}
                            </pre>
                        ) : (
                            <p className="text-[11px] text-muted-foreground">{t("rail.noArguments")}</p>
                        )}
                    </div>
                    {call.result && (
                        <div>
                            <h4 className="legend mb-1">
                                {call.stubbed ? t("rail.result") : t("rail.resultReal")}
                            </h4>
                            <p
                                className={cn(
                                    "whitespace-pre-wrap break-words rounded-[--radius] border border-border bg-muted px-2.5 py-2 text-[11px] leading-relaxed",
                                    call.isError ? "text-destructive-ink" : "text-foreground",
                                )}
                            >
                                {call.result}
                            </p>
                        </div>
                    )}
                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        {call.stubbed ? (
                            <ShieldCheck className="h-3 w-3 text-healthy-ink" weight="bold" />
                        ) : (
                            <Wrench className="h-3 w-3 text-info-ink" weight="bold" />
                        )}
                        {call.stubbed ? t("rail.sandboxNote") : t("rail.realNote")}
                    </p>
                </div>
            )}
        </div>
    );
}

function XRayTab({
    lastTurn,
    displayNames,
}: {
    lastTurn: TurnRecord | null;
    displayNames: Map<string, string>;
}) {
    const t = useTranslations("agentSimulator");

    if (!lastTurn) {
        return (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <Sparkle className="h-5 w-5 text-muted-foreground" weight="regular" />
                <p className="text-xs leading-relaxed text-muted-foreground">{t("rail.xrayEmpty")}</p>
            </div>
        );
    }

    const { debug } = lastTurn;

    return (
        <div className="flex flex-col gap-4 px-3 py-3">
            <section>
                <h3 className="legend mb-1.5">{t("rail.turnHeading", { turn: lastTurn.turn })}</h3>
                <dl className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                    <XRayRow label={t("rail.model")} value={debug.model} mono />
                    <XRayRow
                        label={t("rail.tokens")}
                        value={t("rail.tokensValue", {
                            prompt: debug.promptTokens,
                            completion: debug.completionTokens,
                        })}
                        mono
                    />
                    <XRayRow label={t("rail.latency")} value={`${(lastTurn.latencyMs / 1000).toFixed(1)}s`} mono />
                    {debug.finishReason ? (
                        <XRayRow label={t("rail.finishReason")} value={debug.finishReason} mono />
                    ) : null}
                </dl>
            </section>

            <section>
                <h3 className="legend mb-1.5">{t("rail.context")}</h3>
                <div className="flex flex-wrap gap-1.5">
                    <ContextChip on={debug.memoryInjected} label={t("rail.memories")} />
                    <ContextChip on={debug.ragInjected} label={t("rail.knowledge")} />
                </div>
            </section>

            <section>
                <h3 className="legend mb-1.5">
                    {t("rail.toolsAvailable", { count: debug.toolNames.length })}
                </h3>
                {debug.toolNames.length > 0 ? (
                    <ul className="flex flex-wrap gap-1.5">
                        {debug.toolNames.map((name) => (
                            <li
                                key={name}
                                className="rounded-[--radius] border border-border bg-muted px-2 py-0.5 text-[11px] text-foreground"
                            >
                                {displayNames.get(name) ?? name}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-[11px] text-muted-foreground">{t("rail.noTools")}</p>
                )}
            </section>

            <section>
                <h3 className="legend mb-1.5">{t("rail.systemPrompt")}</h3>
                <pre className="readout max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted px-3 py-2.5 font-mono text-[11px] leading-relaxed text-foreground">
                    {debug.systemPrompt}
                </pre>
            </section>
        </div>
    );
}

function XRayRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0">
            <dt className="legend">{label}</dt>
            <dd title={value} className={cn("truncate text-xs text-foreground", mono && "readout")}>
                {value}
            </dd>
        </div>
    );
}

function ContextChip({ on, label }: { on: boolean; label: string }) {
    const t = useTranslations("agentSimulator");
    return (
        <span className="inline-flex items-center gap-1.5 rounded-[--radius] border border-border bg-muted px-2 py-0.5 text-[11px] text-foreground">
            <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-healthy" : "bg-border-strong")} />
            {label}
            <span className="text-muted-foreground">{on ? t("rail.injected") : t("rail.notInjected")}</span>
        </span>
    );
}
