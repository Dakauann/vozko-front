"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { isAdsError, listAdPagesAction } from "@/app/actions/advertising";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { ClipboardText, Warning } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAdAccounts } from "@/hooks/use-ad-accounts";
import { useKeyedLoad } from "@/hooks/use-keyed-load";
import { accountWritePermissions } from "@/lib/advertising/delivery";
import type { LeadForm } from "@/lib/advertising/forms";
import type { AdAccount, AdPage } from "@/lib/advertising/types";

import { LeadTermsNotice } from "../requirement-steps";
import { AccountGate } from "../account-gate";
import { ReadOnlyNotice } from "../account-notices";
import { AccountPicker } from "../account-picker";
import { FormLeadsView } from "./form-leads-view";
import { FormsPanel } from "./forms-panel";

export interface FormPermissions {
  canCreate: boolean;
  canUpdate: boolean;
}

export function FormsPage() {
  const t = useTranslations("adsForms");
  const { can, permissionsLoading } = useWorkspace();
  const searchParams = useSearchParams();
  const canRead = !permissionsLoading && can("ads", "read");
  const permissions: FormPermissions = {
    canCreate: !permissionsLoading && can("ads", "create"),
    canUpdate: !permissionsLoading && can("ads", "update"),
  };
  const accounts = useAdAccounts({ enabled: canRead, requested: searchParams.get("account") });

  const header = (
    <DashboardPageHeader
      badge={t("header.title")}
      description={t("header.description")}
      icon={<ClipboardText className="h-6 w-6" />}
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
          <AccountForms key={account.id} account={account} permissions={accountWritePermissions(permissions, account)} />
        </div>
      )}
    </AccountGate>
  );
}

function AccountForms({ account, permissions }: { account: AdAccount; permissions: FormPermissions }) {
  const t = useTranslations("adsForms");
  const loadPages = useCallback(() => listAdPagesAction(account.id), [account.id]);
  const pagesLoad = useKeyedLoad(account.id, loadPages);
  const [pageId, setPageId] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState<LeadForm | null>(null);

  const pagesResult = pagesLoad.value;
  const pages: AdPage[] = pagesResult && !isAdsError(pagesResult) ? pagesResult.data : [];
  const pagesError = pagesResult && isAdsError(pagesResult) ? pagesResult.error : null;
  const page = pages.find((candidate) => candidate.pageId === pageId) ?? pages[0] ?? null;

  if (pagesLoad.loading) return <div className="h-40 animate-pulse rounded-[--radius] bg-muted" />;

  if (pagesError || !page) {
    return (
      <div className="flex items-center gap-2 rounded-[--radius] border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
        <Warning className="h-4 w-4" aria-hidden />
        {pagesError ?? t("noPages")}
        {pagesError ? (
          <button type="button" onClick={pagesLoad.reload} className="ml-auto font-semibold text-primary-ink hover:underline">
            {t("retry")}
          </button>
        ) : null}
      </div>
    );
  }

  if (openForm) {
    return <FormLeadsView account={account} form={openForm} onBack={() => setOpenForm(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="w-72 max-w-full">
        <ElevatedSelect label={t("page")} value={page.pageId} onValueChange={setPageId}>
          {pages.map((candidate) => (
            <ElevatedSelectItem key={candidate.pageId} value={candidate.pageId}>
              {candidate.name}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
      </div>
      {!page.leadTermsAccepted ? <LeadTermsNotice pageName={page.name} checking={pagesLoad.loading} onRecheck={pagesLoad.reload} /> : null}
      <FormsPanel key={page.pageId} account={account} page={page} permissions={permissions} onOpen={setOpenForm} />
    </div>
  );
}
