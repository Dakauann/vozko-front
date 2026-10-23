"use client";

import { useTranslations } from "next-intl";

import { Notice } from "@/components/ui/notice";
import type { SendRisk } from "@/lib/whatsapp/send-risk";

export function SendRiskNotice({ subject, risk, className }: { subject: "phone" | "template"; risk: SendRisk | null; className?: string }) {
  const t = useTranslations(`campaignSendRisk.${subject}.${risk ?? "warning"}`);
  if (!risk) return null;
  return (
    <Notice tone={risk} title={t("title")} className={className}>
      <p>{t("body")}</p>
    </Notice>
  );
}
