"use client";

import { use } from "react";

import CreateNewAgentForm from "@/app/[locale]/dashboard/agents/new/CreateNewAgentForm";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import EditAgentLoader from "../_components/EditAgentLoader";
import EditModeSwitch from "../_components/EditModeSwitch";
import EditSimulatorAction from "../_components/EditSimulatorAction";
import { Wrench } from "@/components/icons";
import { useRememberEditMode } from "@/lib/agents/edit-mode";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface PageProps {
    params: Promise<{ agentId: string }>;
}

export default function EditAgentProfessionalPage({ params }: PageProps) {
    const { agentId } = use(params);
    const router = useRouter();
    const tEdit = useTranslations("agents.edit");
    const tChooser = useTranslations("agents.edit.chooser");

    useRememberEditMode(agentId, "professional");

    return (
        <EditAgentLoader agentId={agentId}>
            {(agent) => (
                <main className="w-full space-y-6">
                    <DashboardPageHeader
                        back={{
                            onClick: () => router.push(`/dashboard/agents/${agent.id}/edit`),
                            label: tChooser("backToChooser"),
                        }}
                        icon={<Wrench className="h-5 w-5" weight="fill" />}
                        badge={tEdit("breadcrumb")}
                        title={tChooser("complete.title")}
                        description={tEdit("description")}
                        actions={
                            <div className="flex items-center gap-2">
                                <EditModeSwitch agentId={agent.id} mode="professional" />
                                <EditSimulatorAction agent={agent} />
                            </div>
                        }
                    />
                    <CreateNewAgentForm mode="edit" initialAgent={agent} />
                </main>
            )}
        </EditAgentLoader>
    );
}
