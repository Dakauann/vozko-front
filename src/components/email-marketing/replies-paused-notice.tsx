"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { Wallet } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import type { EmailDomain, EmailSetup } from "@/lib/email-marketing/types";

export const WALLET_TOP_UP_PATH = "/dashboard/invoices";

export function RepliesPausedNotice({ setup }: { setup: EmailSetup }) {
  const t = useTranslations("emailMarketing.replies");
  if (!setup.replies_paused) return null;
  return (
    <Notice tone="fault" title={t("pausedTitle")}>
      <p>{t("pausedText")}</p>
      <Button link={WALLET_TOP_UP_PATH} newTab={false} size="sm" variant="outline" icon={<Wallet className="h-3.5 w-3.5" weight="bold" />} iconVisible title={t("topUp")} />
    </Notice>
  );
}

export function RepliesPausedChip({ domain }: { domain: EmailDomain }) {
  const t = useTranslations("emailMarketing.replies");
  if (!domain.replies_paused) return null;
  return <StatusChip tone="fault" label={t("pausedChip")} />;
}
