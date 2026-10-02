"use client";

import { useTranslations } from "next-intl";

import { LockKey } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "@/i18n/routing";
import { overviewHref } from "@/lib/advertising/connect";
import { manageBlockerKey } from "@/lib/advertising/delivery";
import type { AdAccount } from "@/lib/advertising/types";

export function ReadOnlyNotice({ account }: { account: AdAccount }) {
  const t = useTranslations("adsManager.notices.readOnly");
  if (manageBlockerKey(account) !== "readOnly") return null;
  return (
    <Alert variant="warning">
      <LockKey className="h-4 w-4" />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>{t("body")}</span>
        <Link href={overviewHref(account.id)} className="font-semibold text-primary-ink hover:underline">
          {t("action")}
        </Link>
      </AlertDescription>
    </Alert>
  );
}
