"use client";

import { useTranslations } from "next-intl";

import { ArrowSquareOut, LinkBreak, LockKey, Wallet, Warning } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { accountNotices, manageBlockerKey } from "@/lib/advertising/delivery";
import { META_AD_ACCOUNT_ROLES_URL, metaBillingHref } from "@/lib/advertising/connect";
import type { AdAccount } from "@/lib/advertising/types";

import { RecheckButton } from "./requirement-steps";

interface Recheck {
  checking: boolean;
  onRecheck: () => void;
}

export function AccountNotices({
  account,
  canReconnect,
  reconnecting,
  onReconnect,
  recheck,
}: {
  account: AdAccount;
  canReconnect: boolean;
  reconnecting: boolean;
  onReconnect: () => void;
  recheck: Recheck;
}) {
  const t = useTranslations("adsManager.notices");
  const notices = accountNotices(account);
  if (notices.length === 0) return null;

  return (
    <div className="space-y-2">
      {notices.map((notice) => {
        if (notice === "reconnect") {
          return (
            <Alert key={notice} variant="destructive">
              <LinkBreak className="h-4 w-4" />
              <AlertTitle>{t("reconnect.title")}</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>{t("reconnect.body")}</span>
                {canReconnect ? (
                  <button
                    type="button"
                    onClick={onReconnect}
                    disabled={reconnecting}
                    className="font-semibold text-primary-ink hover:underline disabled:opacity-50"
                  >
                    {t("reconnect.action")}
                  </button>
                ) : null}
              </AlertDescription>
            </Alert>
          );
        }
        if (notice === "readOnly") return <ReadOnlyAlert key={notice} recheck={recheck} />;
        if (notice === "funding") {
          return (
            <Alert key={notice} variant="warning">
              <Wallet className="h-4 w-4" />
              <AlertTitle>{t("funding.title")}</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>{t("funding.body")}</span>
                <a
                  href={metaBillingHref(account.metaAccountId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-primary-ink hover:underline"
                >
                  {t("funding.action")}
                  <ArrowSquareOut className="h-3.5 w-3.5" aria-hidden />
                </a>
                <RecheckButton checking={recheck.checking} onRecheck={recheck.onRecheck} />
              </AlertDescription>
            </Alert>
          );
        }
        return (
          <Alert key={notice} variant="warning">
            <Warning className="h-4 w-4" />
            <AlertTitle>{t("metaStatus.title")}</AlertTitle>
            <AlertDescription>
              {t("metaStatus.body", {
                status: t.has(`metaStatusLabel.${account.metaStatus}`)
                  ? t(`metaStatusLabel.${account.metaStatus}`)
                  : t("metaStatusLabel.unknown"),
              })}
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}

function ReadOnlyAlert({ recheck }: { recheck?: Recheck }) {
  const t = useTranslations("adsManager.notices.readOnly");
  return (
    <Alert variant="warning">
      <LockKey className="h-4 w-4" />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>{t("body")}</span>
        <a
          href={META_AD_ACCOUNT_ROLES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-primary-ink hover:underline"
        >
          {t("action")}
          <ArrowSquareOut className="h-3.5 w-3.5" aria-hidden />
        </a>
        {recheck ? <RecheckButton checking={recheck.checking} onRecheck={recheck.onRecheck} /> : null}
      </AlertDescription>
    </Alert>
  );
}

export function ReadOnlyNotice({ account }: { account: AdAccount }) {
  return manageBlockerKey(account) === "readOnly" ? <ReadOnlyAlert /> : null;
}
