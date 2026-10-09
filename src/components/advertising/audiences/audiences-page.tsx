"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";
import { UsersThree } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAccess } from "@/hooks/use-access";
import { useAdAccounts } from "@/hooks/use-ad-accounts";
import { accountWritePermissions } from "@/lib/advertising/delivery";

import { AccountGate } from "../account-gate";
import { ReadOnlyNotice } from "../account-notices";
import { AccountPicker } from "../account-picker";
import { MetaAudiencesPanel } from "./meta-audiences-panel";
import { SavedAudiencesPanel } from "./saved-audiences-panel";

type AudienceTab = "meta" | "saved";

const LEADS_AUDIENCE_CAPABILITY = "leads.meta_audience";

export function AudiencesPage() {
  const t = useTranslations("adsAudiences");
  const { can, permissionsLoading } = useWorkspace();
  const { decideCapabilities } = useAccess();
  const searchParams = useSearchParams();
  const canRead = !permissionsLoading && can("ads", "read");
  const permissions = {
    canCreate: !permissionsLoading && can("ads", "create"),
    canUpdate: !permissionsLoading && can("ads", "update"),
    canDelete: !permissionsLoading && can("ads", "delete"),
    canCreateFromLeads: !permissionsLoading && can("ads", "create") && decideCapabilities([LEADS_AUDIENCE_CAPABILITY]) === "granted",
  };
  const accounts = useAdAccounts({ enabled: canRead, requested: searchParams.get("account") });
  const [tab, setTab] = useState<AudienceTab>("meta");

  const header = (
    <DashboardPageHeader
      badge={t("header.title")}
      description={t("header.description")}
      icon={<UsersThree className="h-6 w-6" />}
      actions={
        accounts.selected ? <AccountPicker accounts={accounts.accounts} value={accounts.selected.id} onChange={accounts.select} /> : null
      }
    />
  );

  return (
    <AccountGate
      header={header}
      accounts={accounts}
      permissionsLoading={permissionsLoading}
      canRead={canRead}
      canConnect={permissions.canCreate}
    >
      {(account) => (
        <div className="w-full space-y-4">
          {header}
          <Tabs value={tab} onValueChange={(value) => setTab(value === "saved" ? "saved" : "meta")}>
            <TabsList>
              <TabsTrigger value="meta">{t("tabs.meta")}</TabsTrigger>
              <TabsTrigger value="saved">{t("tabs.saved")}</TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === "meta" ? (
            <>
              <ReadOnlyNotice account={account} />
              <MetaAudiencesPanel key={account.id} account={account} permissions={accountWritePermissions(permissions, account)} />
            </>
          ) : (
            <SavedAudiencesPanel account={account} permissions={permissions} />
          )}
        </div>
      )}
    </AccountGate>
  );
}

export interface AudiencePermissions {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canCreateFromLeads: boolean;
}
