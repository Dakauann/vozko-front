"use client";

import { use } from "react";

import BeginnerAgentWizard from "@/app/[locale]/dashboard/agents/new/BeginnerAgentWizard";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import EditAgentLoader from "../_components/EditAgentLoader";
import EditModeSwitch from "../_components/EditModeSwitch";
import EditSimulatorAction from "../_components/EditSimulatorAction";
import { GraduationCap } from "@/components/icons";
import { useRememberEditMode } from "@/lib/agents/edit-mode";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface PageProps {
    params: Promise<{ agentId: string }>;
}

export default function EditAgentBeginnerPage({ params }: PageProps) {
    const { agentId } = use(params);
    const router = useRouter();
    const tEdit = useTranslations("agents.edit");
    const tChooser = useTranslations("agents.edit.chooser");

    useRememberEditMode(agentId, "beginner");

    return (
        <EditAgentLoader agentId={agentId}>
            {(agent) => (
                <main className="w-full space-y-6">
                    <DashboardPageHeader
                        back={{
                            onClick: () => router.push(`/dashboard/agents/${agent.id}/edit`),
                            label: tChooser("backToChooser"),
                        }}
                        icon={<GraduationCap className="h-5 w-5" weight="fill" />}
                        badge={tEdit("breadcrumb")}
                        title={tChooser("guided.title")}
                        description={tEdit("description")}
                        actions={
                            <div className="flex items-center gap-2">
                                <EditModeSwitch agentId={agent.id} mode="beginner" />
                                <EditSimulatorAction agent={agent} />
                            </div>
                        }
                    />
                    <BeginnerAgentWizard
                        mode="edit"
                        initialAgent={agent}
                        onSwitchMode={() =>
                            router.push(`/dashboard/agents/${agent.id}/edit/professional`)
                        }
                        onSaved={(saved) => router.push(`/dashboard/agents/${saved.id}`)}
                    />
                </main>
            )}
        </EditAgentLoader>
    );
}
