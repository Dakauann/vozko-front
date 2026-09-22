"use client";

import { useTranslations } from "next-intl";

import { AccessDenied } from "@/components/ui/access-denied";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { FunnelsManager } from "@/components/crm/funnels/FunnelsManager";
import { Kanban } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";

export default function FunnelsPage() {
  const t = useTranslations("funnels");
  const { can, permissionsLoading } = useWorkspace();

  const canRead = !permissionsLoading && can("stages", "read");

  return (
    <main className="w-full space-y-6">
      <DashboardPageHeader
        icon={<Kanban className="h-[18px] w-[18px]" weight="bold" />}
        badge={t("page.badge")}
        description={t("page.description")}
      />

      {permissionsLoading ? (
        <div className="h-64 animate-pulse rounded-[--radius] bg-muted" aria-hidden="true" />
      ) : canRead ? (
        <FunnelsManager />
      ) : (
        <AccessDenied backHref="/dashboard/live-chat" />
      )}
    </main>
  );
}
