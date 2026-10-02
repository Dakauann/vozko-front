"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Lightning } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAdAccounts } from "@/hooks/use-ad-accounts";
import { accountWritePermissions } from "@/lib/advertising/delivery";

import { AccountGate } from "../account-gate";
import { ReadOnlyNotice } from "../account-notices";
import { AccountPicker } from "../account-picker";
import { RulesPanel } from "./rules-panel";

export interface RulePermissions {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function RulesPage() {
  const t = useTranslations("adsRules");
  const { can, permissionsLoading } = useWorkspace();
  const searchParams = useSearchParams();
  const canRead = !permissionsLoading && can("ads", "read");
  const permissions: RulePermissions = {
    canCreate: !permissionsLoading && can("ads", "create"),
    canUpdate: !permissionsLoading && can("ads", "update"),
    canDelete: !permissionsLoading && can("ads", "delete"),
  };
  const accounts = useAdAccounts({ enabled: canRead, requested: searchParams.get("account") });

  const header = (
    <DashboardPageHeader
      badge={t("header.title")}
      description={t("header.description")}
      icon={<Lightning className="h-6 w-6" />}
      actions={
        accounts.selected ? <AccountPicker accounts={accounts.accounts} value={accounts.selected.id} onChange={accounts.select} /> : null
      }
    />
  );

  return (
    <AccountGate header={header} accounts={accounts} permissionsLoading={permissionsLoading} canRead={canRead} canConnect={permissions.canCreate}>
      {(account) => (
        <div className="w-full space-y-4">
          {header}
          <ReadOnlyNotice account={account} />
          <RulesPanel key={account.id} account={account} permissions={accountWritePermissions(permissions, account)} />
        </div>
      )}
    </AccountGate>
  );
}
