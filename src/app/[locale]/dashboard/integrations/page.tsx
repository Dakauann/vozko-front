"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { ArrowRight, Key, Plugs } from "@/components/icons";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { GoogleAccountCard } from "@/components/google/GoogleAccountCard";
import { useWorkspace } from "@/contexts/workspace-context";
import { API_KEYS_PATH } from "@/lib/api-keys/paths";
import { GOOGLE_SHEETS_PATH } from "@/lib/google-sheets/paths";

export default function IntegrationsPage() {
  const t = useTranslations("integrationsPage");
  const { can } = useWorkspace();
  const seesCalendar = can("calendar", "read");
  const seesSheets = can("google_sheets", "read");
  const seesApiKeys = can("api_keys", "read");

  return (
    <div className="space-y-6">
      <DashboardPageHeader icon={<Plugs size={20} weight="duotone" />} badge={t("badge")} description={t("description")} />

      {seesCalendar ? (
        <GoogleAccountCard product="calendar" canConnect={can("calendar", "create")} canDisconnect={can("calendar", "delete")} returnPath="/dashboard/integrations" />
      ) : null}

      {seesSheets ? (
        <div className="space-y-2">
          <GoogleAccountCard
            product="sheets"
            canConnect={can("google_sheets", "create")}
            canDisconnect={can("google_sheets", "delete")}
            returnPath="/dashboard/integrations"
          />
          <Link href={GOOGLE_SHEETS_PATH} className="inline-flex items-center gap-1.5 px-1 text-sm font-medium text-primary-ink hover:underline">
            {t("manageSheets")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}

      {seesApiKeys ? (
        <PanelSection title={<span className="inline-flex items-center gap-2"><Key className="h-4 w-4" weight="bold" />{t("apiKeysTitle")}</span>} description={t("apiKeysDescription")}>
          <Link href={API_KEYS_PATH} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-ink hover:underline">
            {t("manageApiKeys")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </PanelSection>
      ) : null}
    </div>
  );
}
