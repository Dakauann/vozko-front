"use client";

import { useEffect, useState, type ReactNode } from "react";

import type { Agent } from "@/lib/agents/types";
import { ArrowLeft } from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import { getAgentByIdAction } from "@/app/actions/agents";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

/**
 * Shared fetch + permission gate for every /edit page (chooser, beginner,
 * professional). One implementation so the three routes cannot drift on how
 * an agent loads, who may edit, or what a failure looks like.
 */
export default function EditAgentLoader({
    agentId,
    children,
}: {
    agentId: string;
    children: (agent: Agent) => ReactNode;
}) {
    const router = useRouter();
    const { can, permissionsLoading } = useWorkspace();
    const tAgents = useTranslations("agents");
    const tEdit = useTranslations("agents.edit");
    const [state, setState] = useState<{ loading: boolean; agent?: Agent; error?: string }>({
        loading: true,
    });

    useEffect(() => {
        let cancelled = false;
        getAgentByIdAction(agentId).then(({ agent, error }) => {
            if (cancelled) return;
            setState({ loading: false, agent: agent ?? undefined, error: error ?? undefined });
        });
        return () => {
            cancelled = true;
        };
    }, [agentId]);

    if (state.loading || permissionsLoading) {
        return (
            <main className="flex w-full items-center justify-center py-24">
                <div
                    className="h-8 w-8 animate-spin rounded-full border border-muted border-t-primary"
                    role="status"
                    aria-label={tAgents("loading")}
                />
            </main>
        );
    }

    if (!can("agents", "update")) {
        return (
            <main className="w-full space-y-6">
                <ElevatedButton
                    variant="ghost"
                    title={tEdit("breadcrumb")}
                    icon={<ArrowLeft className="h-4 w-4" weight="bold" />}
                    iconVisible
                    iconSide="left"
                    onClick={() => router.push(`/dashboard/agents/${agentId}`)}
                />
                <div className="rounded-[--radius] border border-border bg-card p-6">
                    <h1 className="text-xl font-semibold text-foreground">
                        {tAgents("error.noPermissionTitle")}
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {tAgents("error.noUpdatePermission")}
                    </p>
                </div>
            </main>
        );
    }

    if (state.error || !state.agent) {
        return (
            <main className="w-full space-y-6">
                <ElevatedButton
                    variant="ghost"
                    title={tEdit("breadcrumb")}
                    icon={<ArrowLeft className="h-4 w-4" weight="bold" />}
                    iconVisible
                    iconSide="left"
                    onClick={() => router.push("/dashboard/agents")}
                />
                <div className="rounded-[--radius] border border-border bg-card p-6">
                    <p className="text-sm font-medium text-foreground">{tAgents("error.title")}</p>
                    {state.error ? (
                        <p className="mt-2 text-sm text-muted-foreground">{state.error}</p>
                    ) : null}
                </div>
            </main>
        );
    }

    return <>{children(state.agent)}</>;
}
