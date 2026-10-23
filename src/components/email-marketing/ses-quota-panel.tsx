"use client";

import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { isActionError } from "@/app/actions/action-result";
import { adminGetEmailSendQuotaAction } from "@/app/actions/email-marketing";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip, type StatusChipTone } from "@/components/elevated-design/status-chip";
import { SectionError, sectionRetryDelay, shouldRetrySection } from "@/lib/analytics/section-query";
import { rateFraction } from "@/lib/email-marketing/figures";
import type { EmailSendQuota } from "@/lib/email-marketing/types";

import { useEmailError } from "./use-email-error";

const QUOTA_REFRESH_MS = 60_000;

type QuotaMode = "production" | "sandbox" | "unread";

function quotaMode(quota: EmailSendQuota): QuotaMode {
  if (!quota.read) return "unread";
  return quota.production_access ? "production" : "sandbox";
}

const MODE_TONE: Record<QuotaMode, StatusChipTone> = {
  production: "healthy",
  sandbox: "warning",
  unread: "muted",
};

function Figure({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="legend">{label}</dt>
      <dd className="mt-1 readout font-display text-lg font-semibold text-foreground">{value}</dd>
      {hint ? <dd className="mt-0.5 text-xs text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}

export function SesQuotaPanel() {
  const t = useTranslations("emailMarketing.admin.quota");
  const format = useFormatter();
  const describe = useEmailError();
  const query = useQuery({
    queryKey: ["admin-email-quota"],
    queryFn: async ({ signal }) => {
      const result = await adminGetEmailSendQuotaAction(signal);
      if (isActionError(result)) throw new SectionError(result.error, result.status, result.code);
      return result.data;
    },
    retry: shouldRetrySection,
    retryDelay: sectionRetryDelay,
    refetchInterval: QUOTA_REFRESH_MS,
    refetchOnWindowFocus: false,
  });
  const quota = query.data;
  const mode = quota ? quotaMode(quota) : null;
  const count = (value: number) => format.number(value);
  const percent = (basisPoints: number) => format.number(rateFraction(basisPoints), { style: "percent", maximumFractionDigits: 1 });

  return (
    <section aria-labelledby="ses-quota-title" className="well px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="ses-quota-title" className="text-sm font-semibold text-foreground">
          {t("title")}
        </h2>
        {mode ? <StatusChip tone={MODE_TONE[mode]} label={t(`mode.${mode}`)} /> : null}
        {quota?.near_limit ? <StatusChip tone="fault" label={t("nearLimit")} /> : null}
        {quota && quota.read && !quota.fresh ? <StatusChip tone="warning" label={t("stale")} /> : null}
      </div>
      {query.isError ? (
        <p className="mt-2 text-xs text-destructive-ink">{t("loadFailed", { error: describe(query.error) })}</p>
      ) : (
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
          <Figure label={t("rate")} value={quota ? t("perSecond", { rate: count(quota.max_send_rate) }) : <EmptyValue />} />
          <Figure
            label={t("day")}
            value={quota ? (quota.unlimited_24_hours ? t("unlimited") : t("used", { used: count(quota.used_24_hours), max: count(quota.max_24_hour_send) })) : <EmptyValue />}
            hint={quota && !quota.unlimited_24_hours ? t("usage", { percent: percent(quota.usage_basis_points) }) : undefined}
          />
          <Figure label={t("reserve")} value={quota ? t("sends", { count: quota.priority_reserve }) : <EmptyValue />} hint={t("reserveHint")} />
          <Figure
            label={t("readAt")}
            value={quota?.read_at ? format.dateTime(new Date(quota.read_at), { dateStyle: "short", timeStyle: "short" }) : <EmptyValue />}
            hint={quota && !quota.read ? t("unreadHint") : undefined}
          />
        </dl>
      )}
    </section>
  );
}
