"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { PanelSection } from "@/components/dashboard/PanelSection";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { CalendarBlank, CalendarCheck, EnvelopeSimple, FlagCheckered, PencilSimple, Play, TextAa } from "@/components/icons";
import { DetailRow, DetailRows } from "@/components/leads/detail/DetailRow";
import { useEmailSenders } from "@/hooks/use-email-campaigns";
import { wizardHref } from "@/lib/email-campaigns/status";
import type { Campaign } from "@/lib/email-campaigns/types";

import { useEmailFormat } from "../shared";

export function EmailSettingsPanel({ campaign, canEdit, className }: { campaign: Campaign; canEdit: boolean; className?: string }) {
  const t = useTranslations("emailCampaigns.detail");
  const { dateTime, date } = useEmailFormat();
  const senders = useEmailSenders();
  const sender = (senders.data ?? []).find((item) => item.id === campaign.sender_id) ?? (senders.data ?? []).find((item) => item.is_default);
  const when = (iso: string | undefined) => (iso ? dateTime(iso, campaign.time_zone) : null);

  return (
    <PanelSection
      boxed
      className={className}
      title={t("settings.title")}
      actions={
        canEdit ? (
          <Link
            href={wizardHref(campaign.id)}
            aria-label={t("edit")}
            className="inline-flex h-7 items-center gap-1.5 rounded-[--radius] px-2 text-xs font-semibold text-foreground hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PencilSimple className="h-3.5 w-3.5" weight="bold" aria-hidden />
            {t("edit")}
          </Link>
        ) : null
      }
    >
      <DetailRows>
        <DetailRow icon={<EnvelopeSimple />} label={t("settings.sender")}>
          {sender ? (sender.display_name ? `${sender.display_name} <${sender.address}>` : sender.address) : <span className="font-normal text-muted-foreground">{t("defaultSender")}</span>}
        </DetailRow>
        <DetailRow icon={<TextAa />} label={campaign.ab_test ? t("subjectA") : t("subject")}>
          {campaign.subject || <EmptyValue />}
        </DetailRow>
        {campaign.ab_test ? (
          <DetailRow icon={<TextAa />} label={t("subjectB")}>
            {campaign.ab_test.variant_b_subject}
          </DetailRow>
        ) : null}
        <DetailRow icon={<TextAa />} label={t("settings.preheader")}>
          {campaign.preheader || <span className="font-normal text-muted-foreground">{t("settings.noPreheader")}</span>}
        </DetailRow>
        <DetailRow icon={<CalendarCheck />} label={t("settings.start")}>
          {when(campaign.scheduled_at) ?? <span className="font-normal text-muted-foreground">{t("settings.startManual")}</span>}
        </DetailRow>
        {campaign.started_at ? (
          <DetailRow icon={<Play />} label={t("settings.started")}>
            {when(campaign.started_at)}
          </DetailRow>
        ) : null}
        {campaign.completed_at ? (
          <DetailRow icon={<FlagCheckered />} label={t("settings.completed")}>
            {when(campaign.completed_at)}
          </DetailRow>
        ) : null}
        <DetailRow icon={<CalendarBlank />} label={t("settings.created")}>
          {date(campaign.created_at)}
        </DetailRow>
      </DetailRows>
    </PanelSection>
  );
}
