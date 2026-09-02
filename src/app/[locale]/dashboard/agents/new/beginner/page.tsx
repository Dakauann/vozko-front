"use client";

import BeginnerAgentWizard from "@/app/[locale]/dashboard/agents/new/BeginnerAgentWizard";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { GraduationCap } from "@/components/icons";
import { useRememberCreateMode } from "@/lib/agents/edit-mode";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * The guided create wizard on its own route, mirroring
 * agents/[agentId]/edit/beginner. Addressable, refresh-safe, and its back
 * button returns to the chooser instead of unwinding component state.
 */
export default function NewAgentBeginnerPage() {
  const router = useRouter();
  const t = useTranslations("agents.new");
  const tChooser = useTranslations("agents.new.chooser");

  useRememberCreateMode("beginner");

  return (
    <main className="w-full space-y-6">
      <DashboardPageHeader
        back={{
          onClick: () => router.push("/dashboard/agents/new"),
          label: tChooser("backToChooser"),
        }}
        icon={<GraduationCap className="h-5 w-5" weight="fill" />}
        badge={t("badge")}
        title={tChooser("beginner.title")}
        description={t("description")}
      />
      <BeginnerAgentWizard
        onSwitchMode={() => router.push("/dashboard/agents/new/professional")}
        onSaved={(agent) => router.push(`/dashboard/agents/${agent.id}`)}
      />
    </main>
  );
}
