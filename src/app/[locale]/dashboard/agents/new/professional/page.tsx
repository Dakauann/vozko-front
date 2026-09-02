"use client";

import CreateNewAgentForm from "@/app/[locale]/dashboard/agents/new/CreateNewAgentForm";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Wrench } from "@/components/icons";
import { useRememberCreateMode } from "@/lib/agents/edit-mode";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * The complete create form on its own route, mirroring
 * agents/[agentId]/edit/professional.
 */
export default function NewAgentProfessionalPage() {
  const router = useRouter();
  const t = useTranslations("agents.new");
  const tChooser = useTranslations("agents.new.chooser");

  useRememberCreateMode("professional");

  return (
    <main className="w-full space-y-6">
      <DashboardPageHeader
        back={{
          onClick: () => router.push("/dashboard/agents/new"),
          label: tChooser("backToChooser"),
        }}
        icon={<Wrench className="h-5 w-5" weight="fill" />}
        badge={t("badge")}
        title={tChooser("professional.title")}
        description={t("description")}
      />
      <CreateNewAgentForm />
    </main>
  );
}
