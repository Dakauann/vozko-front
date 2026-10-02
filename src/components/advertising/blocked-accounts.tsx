"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { isAdsError, syncAdAccountAction } from "@/app/actions/advertising";
import { META_AD_ACCOUNT_ROLES_URL, metaBillingHref } from "@/lib/advertising/connect";
import { spendBlockerKey } from "@/lib/advertising/delivery";
import type { AdAccount } from "@/lib/advertising/types";

import { RecheckButton } from "./requirement-steps";
import { useAdsErrorText } from "./use-ads-error";
import { ExternalLink } from "./wizard/choice-row";

export function useAccountRecheck(onUpdated: (account: AdAccount) => void) {
  const errorText = useAdsErrorText();
  const [checking, setChecking] = useState<string | null>(null);
  const [error, setError] = useState<{ accountId: string; message: string } | null>(null);

  const recheck = async (accountId: string) => {
    setChecking(accountId);
    setError(null);
    const result = await syncAdAccountAction(accountId);
    setChecking(null);
    if (isAdsError(result)) {
      setError({ accountId, message: errorText(result) });
      return;
    }
    onUpdated(result.data);
  };

  return { checking, error, recheck };
}

function BlockedAccountRow({
  account,
  checking,
  error,
  onRecheck,
}: {
  account: AdAccount;
  checking: boolean;
  error: string | null;
  onRecheck: () => void;
}) {
  const t = useTranslations("adsAccounts");
  const reason = spendBlockerKey(account) ?? "unknown";
  return (
    <li className="space-y-1 rounded-[--radius] border border-border bg-muted px-3 py-2.5">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-foreground">
          {account.name} · {account.currency}
        </span>
        <span className="rounded-full bg-background px-2 py-0.5 text-2xs font-medium text-muted-foreground">{t(`reasons.${reason}`)}</span>
      </p>
      {reason === "funding" ? (
        <>
          <p className="text-xs text-muted-foreground">{t("fundingHint")}</p>
          <div className="flex flex-wrap items-center gap-4">
            <ExternalLink href={metaBillingHref(account.metaAccountId)}>{t("addPayment")}</ExternalLink>
            <RecheckButton checking={checking} onRecheck={onRecheck} />
          </div>
        </>
      ) : null}
      {reason === "readOnly" ? (
        <>
          <p className="text-xs text-muted-foreground">{t("readOnlyHint")}</p>
          <div className="flex flex-wrap items-center gap-4">
            <ExternalLink href={META_AD_ACCOUNT_ROLES_URL}>{t("rolesLink")}</ExternalLink>
            <RecheckButton checking={checking} onRecheck={onRecheck} />
          </div>
        </>
      ) : null}
      {reason !== "funding" && reason !== "readOnly" ? <p className="text-xs text-muted-foreground">{t(`hints.${reason}`)}</p> : null}
      {error ? <p className="text-xs text-destructive-ink">{error}</p> : null}
    </li>
  );
}

export function BlockedAccounts({ accounts, onUpdated }: { accounts: AdAccount[]; onUpdated: (account: AdAccount) => void }) {
  const t = useTranslations("adsAccounts");
  const { checking, error, recheck } = useAccountRecheck(onUpdated);
  if (accounts.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">{t("blockedTitle")}</p>
      <ul className="space-y-2">
        {accounts.map((account) => (
          <BlockedAccountRow
            key={account.id}
            account={account}
            checking={checking === account.id}
            error={error?.accountId === account.id ? error.message : null}
            onRecheck={() => void recheck(account.id)}
          />
        ))}
      </ul>
    </div>
  );
}
