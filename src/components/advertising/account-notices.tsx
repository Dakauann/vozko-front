"use client";

import { useTranslations } from "next-intl";

import { ArrowSquareOut, LinkBreak, Wallet, Warning } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { accountNotices } from "@/lib/advertising/delivery";
import { META_BILLING_URL } from "@/lib/advertising/connect";
import type { AdAccount } from "@/lib/advertising/types";

export function AccountNotices({
  account,
  canReconnect,
  reconnecting,
  onReconnect,
}: {
  account: AdAccount;
  canReconnect: boolean;
  reconnecting: boolean;
  onReconnect: () => void;
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
        if (notice === "funding") {
          return (
            <Alert key={notice} variant="warning">
              <Wallet className="h-4 w-4" />
              <AlertTitle>{t("funding.title")}</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>{t("funding.body")}</span>
                <a
                  href={META_BILLING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-primary-ink hover:underline"
                >
                  {t("funding.action")}
                  <ArrowSquareOut className="h-3.5 w-3.5" aria-hidden />
                </a>
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
