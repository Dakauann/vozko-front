"use client";

import { use, useCallback, useEffect, useState } from "react";
import { getAgentByIdAction, getAgentToolsAction } from "@/app/actions/agents";
import type { Agent, AgentToolDefinition } from "@/lib/agents/types";

import { ArrowLeft } from "@/components/icons";
import Link from "next/link";
import SimulatorClient from "./_components/SimulatorClient";
import { useTranslations } from "next-intl";

interface SimulatorPageProps {
    params: Promise<{ agentId: string }>;
}

interface PageState {
    loading: boolean;
    error?: string;
    agent?: Agent;
    tools?: AgentToolDefinition[];
}

export default function AgentSimulatorPage({ params }: SimulatorPageProps) {
    const { agentId } = use(params);
    const t = useTranslations("agentSimulator");
    const [state, setState] = useState<PageState>({ loading: true });

    // load never touches state synchronously (initial state already reads
    // loading); retry flips loading itself before re-running.
    const load = useCallback(() => {
        let cancelled = false;

        Promise.all([getAgentByIdAction(agentId), getAgentToolsAction()]).then(
            ([agentResult, toolsResult]) => {
                if (cancelled) return;
                if (agentResult.error || !agentResult.agent) {
                    setState({ loading: false, error: agentResult.error ?? undefined });
                    return;
                }
                setState({
                    loading: false,
                    agent: agentResult.agent,
                    // The catalog only feeds display names; a failure degrades to
                    // raw tool names rather than blocking the page.
                    tools: toolsResult.tools ?? [],
                });
            },
        );
        return () => {
            cancelled = true;
        };
    }, [agentId]);

    useEffect(() => load(), [load]);

    if (state.loading) {
        return (
            <main className="flex w-full items-center justify-center py-24">
                <div
                    className="h-8 w-8 animate-spin rounded-full border border-muted border-t-primary"
                    role="status"
                    aria-label={t("loading")}
                />
            </main>
        );
    }

    if (state.error !== undefined || !state.agent) {
        return (
            <main className="flex w-full flex-col items-center gap-3 py-24 text-center">
                <p className="text-sm font-medium text-foreground">{t("errors.loadFailed")}</p>
                {state.error && state.error !== t("errors.loadFailed") ? (
                    <p className="max-w-md text-xs text-muted-foreground">{state.error}</p>
                ) : null}
                <div className="flex items-center gap-2">
                    <Link
                        href="/dashboard/agents"
                        className="inline-flex h-8 max-sm:min-h-[34px] items-center gap-1.5 rounded-[--radius] border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors duration-DEFAULT hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
                        {t("backToAgent")}
                    </Link>
                    <button
                        type="button"
                        onClick={() => {
                            setState({ loading: true });
                            load();
                        }}
                        className="inline-flex h-8 max-sm:min-h-[34px] items-center rounded-[--radius] bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-button transition-colors duration-DEFAULT hover:bg-primary-hover active:bg-primary-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {t("retry")}
                    </button>
                </div>
            </main>
        );
    }

    return <SimulatorClient agent={state.agent} toolCatalog={state.tools ?? []} />;
}
