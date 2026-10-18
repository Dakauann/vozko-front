"use client";

import { AgentModeChooser } from "@/components/agents/AgentModeChooser";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Robot } from "@/components/icons";
import { useCreateModeLead } from "@/lib/agents/edit-mode";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function NewAgentPage() {
  const router = useRouter();
  const t = useTranslations("agents.new");
  const tChooser = useTranslations("agents.new.chooser");
  const lead = useCreateModeLead();

  return (
    <main className="w-full space-y-6">
      <DashboardPageHeader
        back={{
          onClick: () => router.push("/dashboard/agents"),
          label: t("backButton"),
        }}
        icon={<Robot className="h-5 w-5" weight="fill" />}
        badge={t("badge")}
        title={t("title")}
        description={tChooser("description")}
      />
      <AgentModeChooser
        legend={tChooser("legend")}
        lead={lead}
        leadLabels={{ remembered: tChooser("lastUsed"), suggested: tChooser("suggested") }}
        options={[
          {
            mode: "beginner",
            title: tChooser("beginner.title"),
            description: tChooser("beginner.description"),
            cta: tChooser("beginner.cta"),
            href: "/dashboard/agents/new/beginner",
          },
          {
            mode: "professional",
            title: tChooser("professional.title"),
            description: tChooser("professional.description"),
            cta: tChooser("professional.cta"),
            href: "/dashboard/agents/new/professional",
          },
        ]}
      />
    </main>
  );
}
