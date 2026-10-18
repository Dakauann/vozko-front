"use client";

import { use } from "react";

import type { Agent } from "@/lib/agents/types";
import { AgentModeChooser } from "@/components/agents/AgentModeChooser";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import EditAgentLoader from "./_components/EditAgentLoader";
import EditSimulatorAction from "./_components/EditSimulatorAction";
import { Robot } from "@/components/icons";
import { useEditModeLead } from "@/lib/agents/edit-mode";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface PageProps {
    params: Promise<{ agentId: string }>;
}

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
                    <EditModes agent={agent} />
                </main>
            )}
        </EditAgentLoader>
    );
}

function EditModes({ agent }: { agent: Agent }) {
    const tChooser = useTranslations("agents.edit.chooser");
    const lead = useEditModeLead(agent);

    return (
        <AgentModeChooser
            legend={tChooser("legend")}
            lead={lead}
            leadLabels={{ remembered: tChooser("lastUsed"), suggested: tChooser("suggested") }}
            options={[
                {
                    mode: "beginner",
                    title: tChooser("guided.title"),
                    description: tChooser("guided.description"),
                    cta: tChooser("guided.cta"),
                    href: `/dashboard/agents/${agent.id}/edit/beginner`,
                },
                {
                    mode: "professional",
                    title: tChooser("complete.title"),
                    description: tChooser("complete.description"),
                    cta: tChooser("complete.cta"),
                    href: `/dashboard/agents/${agent.id}/edit/professional`,
                },
            ]}
        />
    );
}
