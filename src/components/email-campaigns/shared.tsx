"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";

import { StatusChip } from "@/components/elevated-design/status-chip";
import { useWorkspace } from "@/contexts/workspace-context";
import type { ResourceAction, ResourceType } from "@/lib/workspace/types";
import { codedErrorMessage, type CodedError } from "@/lib/api/coded-error";
import { localeTagFor } from "@/components/dashboard/attendance/primitives";
import { formatBasisPoints, formatBrl, formatBrlMicros, formatUnitBrl, formatUnitBrlMicros } from "@/lib/email-campaigns/format";
import { holdReasonOf, STATUS_TONE } from "@/lib/email-campaigns/status";
import type { CampaignStatus } from "@/lib/email-campaigns/types";

export const EMAIL_RESOURCE: ResourceType = "email_marketing";

export const EMAIL_SERIES_COLOR = {
  sent: "hsl(var(--chart-4))",
  delivered: "hsl(var(--chart-2))",
  opens: "hsl(var(--chart-1))",
  clicks: "hsl(var(--chart-5))",
  bounces: "hsl(var(--destructive))",
  complaints: "hsl(var(--warning))",
  unsubscribes: "hsl(var(--muted-foreground))",
  pending: "hsl(var(--plate-neutral))",
  skipped: "hsl(var(--mark-skipped))",
  failed: "hsl(var(--destructive))",
} as const;

export type EmailSeries = keyof typeof EMAIL_SERIES_COLOR;

export function useEmailPermission() {
  const { can } = useWorkspace();
  return useCallback((action: ResourceAction) => can(EMAIL_RESOURCE, action), [can]);
}

export function useEmailErrorMessage() {
  const t = useTranslations("emailCampaigns");
  return useCallback((error: CodedError, fallbackKey = "errors.generic") => codedErrorMessage(t, error, t(fallbackKey)), [t]);
}

export function useEmailFormat() {
  const locale = localeTagFor(useLocale());
  const format = useFormatter();
  return {
    locale,
    number: (value: number) => format.number(value),
    rate: (bps: number) => formatBasisPoints(bps, locale),
    money: (micros: number, exchangeRate: number | null) => formatBrlMicros(micros, exchangeRate, locale),
    unitMoney: (micros: number, exchangeRate: number | null) => formatUnitBrlMicros(micros, exchangeRate, locale),
    brl: (reais: number | null | undefined, distinctFrom?: number) => formatBrl(reais, locale, 2, distinctFrom),
    unitBrl: (reais: number | null | undefined) => formatUnitBrl(reais, locale),
    dateTime: (iso: string, timeZone?: string) => format.dateTime(new Date(iso), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", ...(timeZone ? { timeZone } : {}) }),
    date: (iso: string) => format.dateTime(new Date(iso), { day: "2-digit", month: "short", year: "numeric" }),
  };
}

export function EmailCampaignStatusChip({ status, holdReason, scheduledAt, className }: { status: CampaignStatus; holdReason?: string; scheduledAt?: string; className?: string }) {
  const t = useTranslations("emailCampaigns");
  const { dateTime } = useEmailFormat();
  const hold = holdReasonOf(holdReason);
  let label = t(`status.${status}`);
  if (status === "scheduled" && scheduledAt) label = t("status.scheduledFor", { date: dateTime(scheduledAt) });
  if (status === "held" && hold) label = hold === "balance_insufficient" ? t("status.awaitingBalance") : t("status.heldBecause", { reason: t(`hold.short.${hold}`) });
  return <StatusChip tone={STATUS_TONE[status]} label={label} className={className} />;
}
