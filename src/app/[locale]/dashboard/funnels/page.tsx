"use client";

import { useTranslations } from "next-intl";

import { AccessDenied } from "@/components/ui/access-denied";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { FunnelsManager } from "@/components/crm/funnels/FunnelsManager";
import { Kanban } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";

/**
 * Funis — where a workspace designs the boards its conversations run on.
 *
 * It replaces the retired Grupos de etapas route, and it is a route rather than
 * a dialog on the CRM for the reason every CRM in this category makes it one:
 * designing a process is configuration work, done occasionally, with several
 * funnels compared against each other. The board's own selector keeps a shortcut
 * for creating one without leaving a conversation, which is a different moment
 * and deserves the lighter affordance.
 */
export default function FunnelsPage() {
  const t = useTranslations("funnels");
  const { can, permissionsLoading } = useWorkspace();

  // Stages are the resource: a funnel is the set of them, and the API gates
  // /pipelines on exactly this.
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
