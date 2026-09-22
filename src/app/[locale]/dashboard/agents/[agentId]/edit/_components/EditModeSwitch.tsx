"use client";

import { GraduationCap, Wrench } from "@/components/icons";

import type { AgentEditMode } from "@/lib/agents/edit-mode";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function EditModeSwitch({
    agentId,
    mode,
}: {
    agentId: string;
    mode: AgentEditMode;
}) {
    const router = useRouter();
    const t = useTranslations("agents.edit.chooser");

    return (
        <ElevatedPillToggle<AgentEditMode>
            options={[
                {
                    value: "beginner",
                    label: t("switch.guided"),
                    icon: <GraduationCap className="h-3.5 w-3.5" weight="bold" />,
                },
                {
                    value: "professional",
                    label: t("switch.complete"),
                    icon: <Wrench className="h-3.5 w-3.5" weight="bold" />,
                },
            ]}
            value={mode}
            onChange={(next) => {
                if (next !== mode) {
                    router.push(`/dashboard/agents/${agentId}/edit/${next}`);
                }
            }}
        />
    );
}
