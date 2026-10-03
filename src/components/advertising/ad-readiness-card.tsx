"use client";

import { useTranslations } from "next-intl";

import { CheckCircle } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAdAccounts } from "@/hooks/use-ad-accounts";
import { accountIsReady } from "@/lib/advertising/readiness";
import type { AdAccount } from "@/lib/advertising/types";

import { WizardReadinessBanner } from "./readiness";
import { useAdReadiness } from "./use-ad-readiness";

function AccountReadiness({ account, onAccountUpdated, canCreate }: { account: AdAccount; onAccountUpdated: (account: AdAccount) => void; canCreate: boolean }) {
  const t = useTranslations("adsReadiness.card");
  const readiness = useAdReadiness(account, onAccountUpdated);
  if (readiness.loading) return <div className="h-16 animate-pulse rounded-[--radius] bg-muted" />;
  if (accountIsReady(readiness.readiness)) {
    return (
      <p className="flex items-center gap-2 rounded-[--radius] border border-border bg-card px-3 py-2 text-sm text-healthy-ink">
        <CheckCircle className="h-4 w-4" weight="fill" aria-hidden />
        {t("ready", { account: account.name })}
      </p>
    );
  }
  return <WizardReadinessBanner account={account} state={readiness} canCreate={canCreate} defaultOpen />;
}

export function AdReadinessCard({ adAccountId }: { adAccountId: string }) {
  const t = useTranslations("adsReadiness.card");
  const { can, permissionsLoading } = useWorkspace();
  const canRead = !permissionsLoading && can("ads", "read");
  const canCreate = !permissionsLoading && can("ads", "create");
  const accounts = useAdAccounts({ enabled: canRead, requested: adAccountId });
  if (!canRead) return null;
  if (accounts.loading) return <div className="h-16 animate-pulse rounded-[--radius] bg-muted" />;
  const account = accounts.accounts.find((candidate) => candidate.id === adAccountId);
  if (!account) return <p className="text-sm text-muted-foreground">{t("missing")}</p>;
  return <AccountReadiness account={account} onAccountUpdated={accounts.replace} canCreate={canCreate} />;
}
