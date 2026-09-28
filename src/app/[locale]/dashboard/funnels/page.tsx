"use client";

import { useTranslations } from "next-intl";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { FunnelsManager } from "@/components/crm/funnels/FunnelsManager";
import { Kanban } from "@/components/icons";

export default function FunnelsPage() {
  const t = useTranslations("funnels");
  return (
    <main className="w-full space-y-6">
      <DashboardPageHeader
        icon={<Kanban className="h-[18px] w-[18px]" weight="bold" />}
        badge={t("page.badge")}
        description={t("page.description")}
      />

      <FunnelsManager />
    </main>
  );
}
