"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { listPixelsAction } from "@/app/actions/advertising-conversions";
import { isAdsError } from "@/app/actions/advertising";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { ChartLineUp } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAdAccounts } from "@/hooks/use-ad-accounts";
import { useKeyedLoad } from "@/hooks/use-keyed-load";
import type { AdAccount } from "@/lib/advertising/types";

import { AccountGate } from "../account-gate";
import { AccountPicker } from "../account-picker";
import { ConversionSettingsCard } from "./conversion-settings-card";
import { PixelsCard } from "./pixels-card";
import { RecentConversions } from "./recent-conversions";

export interface ConversionPermissions {
  canCreate: boolean;
  canUpdate: boolean;
}

export function ConversionsPage() {
  const t = useTranslations("adsConversions");
  const { can, permissionsLoading } = useWorkspace();
  const searchParams = useSearchParams();
  const canRead = !permissionsLoading && can("ads", "read");
  const permissions: ConversionPermissions = {
    canCreate: !permissionsLoading && can("ads", "create"),
    canUpdate: !permissionsLoading && can("ads", "update"),
  };
  const accounts = useAdAccounts({ enabled: canRead, requested: searchParams.get("account") });

  const header = (
    <DashboardPageHeader
      badge={t("header.title")}
      description={t("header.description")}
      icon={<ChartLineUp className="h-6 w-6" />}
      actions={
        accounts.selected ? <AccountPicker accounts={accounts.accounts} value={accounts.selected.id} onChange={accounts.select} /> : null
      }
    />
  );

  return (
    <AccountGate header={header} accounts={accounts} permissionsLoading={permissionsLoading} canRead={canRead} canConnect={permissions.canCreate}>
      {(account) => (
        <div className="w-full space-y-6">
          {header}
          <AccountConversions key={account.id} account={account} accounts={accounts.accounts} permissions={permissions} />
        </div>
      )}
    </AccountGate>
  );
}

function AccountConversions({
  account,
  accounts,
  permissions,
}: {
  account: AdAccount;
  accounts: AdAccount[];
  permissions: ConversionPermissions;
}) {
  const load = useCallback(() => listPixelsAction(account.id), [account.id]);
  const pixels = useKeyedLoad(account.id, load);
  const response = pixels.latest;
  const list = response && !isAdsError(response) ? response.data : [];
  const error = response && isAdsError(response) ? response.error : null;

  return (
    <>
      <ConversionSettingsCard account={account} accounts={accounts} pixels={list} permissions={permissions} />
      <PixelsCard
        account={account}
        pixels={list}
        loading={pixels.loading && !response}
        error={error}
        permissions={permissions}
        onReload={pixels.reload}
      />
      <RecentConversions />
    </>
  );
}
