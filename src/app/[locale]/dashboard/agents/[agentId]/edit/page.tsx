"use client";

import { CaretRight, GraduationCap, Robot, Wrench } from "@/components/icons";
import {
    type AgentEditMode,
    inferEditMode,
    recallEditMode,
} from "@/lib/agents/edit-mode";
import { use, useEffect, useState } from "react";

import type { Agent } from "@/lib/agents/types";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import EditAgentLoader from "./_components/EditAgentLoader";
import EditSimulatorAction from "./_components/EditSimulatorAction";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface PageProps {
    params: Promise<{ agentId: string }>;
}

/**
 * The edit-mode selector as a page. The operator is not asked to classify
 * themselves ("beginner? professional?") on every visit: the mode this agent
 * was last edited in — or, on first visit, the mode its own configuration
 * implies — leads as the marked row, so the common path is one click and the
 * choice never has to be re-reasoned. Two quiet rows, task-named, no
 * sell-copy: this is a fork in an operator's workday, not a pricing table.
 */
export default function EditAgentChooserPage({ params }: PageProps) {
    const { agentId } = use(params);
    const router = useRouter();
    const tEdit = useTranslations("agents.edit");
    const tChooser = useTranslations("agents.edit.chooser");

    return (
        <EditAgentLoader agentId={agentId}>
            {(agent) => (
                <main className="w-full space-y-6">
                    <DashboardPageHeader
                        back={{
                            onClick: () => router.push(`/dashboard/agents/${agent.id}`),
                            label: tEdit("breadcrumb"),
                        }}
                        icon={<Robot className="h-5 w-5" weight="fill" />}
                        badge={tEdit("breadcrumb")}
                        title={tEdit("title")}
                        description={tChooser("description")}
                        actions={<EditSimulatorAction agent={agent} />}
                    />
                    <ModeList agent={agent} />
                </main>
            )}
        </EditAgentLoader>
    );
}

function ModeList({ agent }: { agent: Agent }) {
    const tChooser = useTranslations("agents.edit.chooser");

    // Remembered beats inferred; both resolve client-side, so the lead marker
    // appears after mount (null during SSR keeps markup stable).
    const [lead, setLead] = useState<{ mode: AgentEditMode; remembered: boolean } | null>(null);
    useEffect(() => {
        const remembered = recallEditMode(agent.id);
        setLead(
            remembered
                ? { mode: remembered, remembered: true }
                : { mode: inferEditMode(agent), remembered: false },
        );
    }, [agent]);

    const modes: {
        mode: AgentEditMode;
        title: string;
        description: string;
        icon: React.ReactNode;
        tile: string;
    }[] = [
        {
            mode: "beginner",
            title: tChooser("guided.title"),
            description: tChooser("guided.description"),
            icon: <GraduationCap className="h-5 w-5" weight="bold" />,
            tile: "tile-2",
        },
        {
            mode: "professional",
            title: tChooser("complete.title"),
            description: tChooser("complete.description"),
            icon: <Wrench className="h-5 w-5" weight="bold" />,
            tile: "tile-4",
        },
    ];

    // The lead mode renders first: the marked row is also the first row, so
    // keyboard and reading order agree with the visual emphasis.
    const ordered = lead
        ? [...modes].sort((a, b) => (a.mode === lead.mode ? -1 : b.mode === lead.mode ? 1 : 0))
        : modes;

    return (
        <section aria-label={tChooser("legend")} className="mx-auto w-full max-w-2xl">
            <h2 className="legend mb-2">{tChooser("legend")}</h2>
            <ul className="flex flex-col gap-3">
                {ordered.map(({ mode, title, description, icon, tile }) => {
                    const isLead = lead?.mode === mode;
                    return (
                        <li key={mode}>
                            <Link
                                href={`/dashboard/agents/${agent.id}/edit/${mode}`}
                                className={cn(
                                    "group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all duration-DEFAULT",
                                    "hover:-translate-y-px hover:shadow motion-reduce:transform-none",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                    "max-sm:min-h-[34px] sm:p-5",
                                    isLead ? "border-border-strong" : "border-border",
                                )}
                            >
                                <span
                                    className={cn(
                                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-[--radius] shadow-sm",
                                        tile,
                                    )}
                                >
                                    {icon}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="flex flex-wrap items-center gap-2">
                                        <span
                                            className={cn(
                                                "text-sm text-foreground",
                                                isLead ? "font-semibold" : "font-medium",
                                            )}
                                        >
                                            {title}
                                        </span>
                                        {isLead && lead ? (
                                            <span className="rounded-[--radius] bg-muted px-2 py-0.5 text-[11px] font-medium text-primary-ink">
                                                {lead.remembered
                                                    ? tChooser("lastUsed")
                                                    : tChooser("suggested")}
                                            </span>
                                        ) : null}
                                    </span>
                                    <span className="mt-0.5 block text-sm text-muted-foreground">
                                        {description}
                                    </span>
                                </span>
                                <CaretRight
                                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-DEFAULT group-hover:translate-x-0.5 motion-reduce:transform-none"
                                    weight="bold"
                                />
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
