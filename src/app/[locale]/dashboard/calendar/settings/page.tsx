"use client";

import { useTranslations } from "next-intl";

import { Gear } from "@/components/icons";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { GoogleAccountCard } from "@/components/google/GoogleAccountCard";
import { useWorkspace } from "@/contexts/workspace-context";

export default function CalendarSettingsPage() {
  const t = useTranslations("calendarSettingsPage");
  const { can } = useWorkspace();

  return (
    <div className="space-y-6">
      <DashboardPageHeader icon={<Gear size={20} weight="duotone" />} badge={t("badge")} description={t("description")} />
      <GoogleAccountCard
        product="calendar"
        canConnect={can("calendar", "create")}
        canDisconnect={can("calendar", "delete")}
        returnPath="/dashboard/calendar/settings"
      />
    </div>
  );
}
