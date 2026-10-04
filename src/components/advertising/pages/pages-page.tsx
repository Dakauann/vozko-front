"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { isAdsError, listAdPagesAction } from "@/app/actions/advertising";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Storefront } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAdAccounts } from "@/hooks/use-ad-accounts";
import { useKeyedLoad } from "@/hooks/use-keyed-load";
import { accountWritePermissions } from "@/lib/advertising/delivery";
import type { AdAccount } from "@/lib/advertising/types";

import { AccountGate } from "../account-gate";
import { ReadOnlyNotice } from "../account-notices";
import { AccountPicker } from "../account-picker";
import { PageAssetsList } from "./page-assets-list";

export function PagesPage() {
  const t = useTranslations("adsPages");
  const { can, permissionsLoading } = useWorkspace();
  const searchParams = useSearchParams();
  const canRead = !permissionsLoading && can("ads", "read");
  const canCreate = !permissionsLoading && can("ads", "create");
  const canUpdate = !permissionsLoading && can("ads", "update");
  const accounts = useAdAccounts({ enabled: canRead, requested: searchParams.get("account") });

  const header = (
    <DashboardPageHeader
      badge={t("header.title")}
      description={t("header.description")}
      icon={<Storefront className="h-6 w-6" />}
      actions={
        accounts.selected ? <AccountPicker accounts={accounts.accounts} value={accounts.selected.id} onChange={accounts.select} /> : null
      }
    />
  );

  return (
    <AccountGate header={header} accounts={accounts} permissionsLoading={permissionsLoading} canRead={canRead} canConnect={canCreate}>
      {(account) => (
        <div className="w-full space-y-6">
          {header}
          <ReadOnlyNotice account={account} />
          <AccountPages key={account.id} account={account} canLink={accountWritePermissions({ canUpdate }, account).canUpdate} />
        </div>
      )}
    </AccountGate>
  );
}

function AccountPages({ account, canLink }: { account: AdAccount; canLink: boolean }) {
  const t = useTranslations("adsPages");
  const load = useCallback(() => listAdPagesAction(account.id), [account.id]);
  const pages = useKeyedLoad(account.id, load);
  const response = pages.latest;
  if (!response) return <div className="h-40 animate-pulse rounded-[--radius] bg-muted" />;
  if (isAdsError(response)) {
    return (
      <p role="alert" className="text-sm text-destructive-ink">
        {response.error}{" "}
        <button type="button" onClick={pages.reload} className="font-semibold text-primary-ink hover:underline">
          {t("retry")}
        </button>
      </p>
    );
  }
  return <PageAssetsList accountId={account.id} pages={response.data} canLink={canLink} checking={pages.loading} onChanged={pages.reload} />;
}
