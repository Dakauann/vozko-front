"use client";

import { useTranslations } from "next-intl";

import { Notice } from "@/components/ui/notice";
import { isPausedAccount } from "@/lib/email-marketing/ladder";
import type { EmailAccount } from "@/lib/email-marketing/types";

export function PausedAccountNotice({ account }: { account: EmailAccount }) {
  const t = useTranslations("emailMarketing.account");
  if (!isPausedAccount(account.status)) return null;
  return (
    <Notice tone="fault" title={t(`pausedTitle.${account.status}`)}>
      {account.status_reason ? <p className="text-foreground">{account.status_reason}</p> : null}
      <p>{t(`pausedHelp.${account.status}`)}</p>
    </Notice>
  );
}
