"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { getAdsReportAction, getAdsTrendAction } from "@/app/actions/advertising";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { SquaresFour } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAdAccounts } from "@/hooks/use-ad-accounts";
import { civilToday, rangeForPreset } from "@/lib/advertising/date-range";
import { deliveryKey } from "@/lib/advertising/delivery";
import { metaPortalUrl } from "@/lib/advertising/readiness";
import type { AdAccount, AdReport, AdTrend } from "@/lib/advertising/types";

import { AccountGate } from "../account-gate";
import { AccountPicker } from "../account-picker";
import { AdsKpiStrip } from "../ads-kpi-strip";
import { AdsTrendChart } from "../ads-trend-chart";
import { ReadinessCard } from "../readiness";
import { SpendCapControl } from "../spend-cap-control";
import { useAdReadiness, type AdReadinessState } from "../use-ad-readiness";
import { useAdsFormat } from "../use-ads-format";
import { ExternalLink } from "../wizard/choice-row";
import { useAdsResource } from "../wizard/use-ads-resource";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 rounded-[--radius] border border-border bg-card p-5 shadow-sm">
      <h2 className="font-display text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function AccountSummary({ account }: { account: AdAccount }) {
  const t = useTranslations("adsOverview");
  const fmt = useAdsFormat();
  const [now] = useState(() => new Date());
  const today = civilToday(account.timezone, now);
  const report = useAdsResource<AdReport>(today ? `overview:${account.id}:${today}` : null, () =>
    getAdsReportAction(account.id, { level: "campaign", range: rangeForPreset("last7", today ?? "") }),
  );
  const data = report.status === "ready" ? report.data : null;
  const active = data ? (data.rows ?? []).filter((row) => deliveryKey(row.delivery) === "active").length : null;
  const pending = report.status === "error" ? t("summary.unavailable") : t("summary.loading");
  const status = t.has(`status.${account.metaStatus}`) ? t(`status.${account.metaStatus}`) : t("status.unknown");
  const role = t.has(`roles.${account.role}`) ? t(`roles.${account.role}`) : t("roles.read_only");

  return (
    <Panel title={t("summary.title")}>
      <dl className="divide-y divide-border">
        <Fact label={t("summary.name")} value={account.name} />
        <Fact label={t("summary.id")} value={account.metaAccountId} />
        {account.businessName ? <Fact label={t("summary.business")} value={account.businessName} /> : null}
        <Fact label={t("summary.currency")} value={account.currency || t("summary.unavailable")} />
        <Fact label={t("summary.timezone")} value={account.timezone || t("summary.unavailable")} />
        <Fact label={t("summary.status")} value={status} />
        <Fact label={t("summary.role")} value={role} />
        <Fact label={t("summary.activeCampaigns")} value={active === null ? pending : fmt.count(active)} />
        <Fact label={t("summary.spend7d")} value={data ? fmt.micros(data.totals.spend, data.totals.currency || account.currency) : pending} />
      </dl>
    </Panel>
  );
}

function PerformanceSection({ account }: { account: AdAccount }) {
  const t = useTranslations("adsOverview.performance");
  const [now] = useState(() => new Date());
  const today = civilToday(account.timezone, now);
  const range = today ? rangeForPreset("last30", today) : null;
  const key = range ? `${account.id}:${range.since}:${range.until}` : null;
  const report = useAdsResource<AdReport>(key ? `overview-performance:${key}` : null, () =>
    getAdsReportAction(account.id, { level: "campaign", range: range ?? { since: "", until: "" }, compare: true }),
  );
  const trend = useAdsResource<AdTrend>(key ? `overview-trend:${key}` : null, () => getAdsTrendAction(account.id, { range: range ?? { since: "", until: "" } }));
  const data = report.status === "ready" ? report.data : null;

  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h2 className="font-display text-base font-semibold text-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{range ? t("description") : t("noTimezone")}</p>
      </div>
      {report.status === "error" ? <p className="text-sm text-destructive-ink">{t("failed", { message: report.message })}</p> : null}
      <AdsKpiStrip totals={data?.totals ?? null} outcome={data?.outcome ?? null} previous={data?.previous ?? null} loading={!!range && report.status === "loading"} />
      <AdsTrendChart trend={trend.status === "ready" ? trend.data : null} loading={!!range && trend.status === "loading"} />
    </section>
  );
}

function BillingSummary({
  account,
  state,
  canUpdate,
  onAccountUpdated,
}: {
  account: AdAccount;
  state: AdReadinessState;
  canUpdate: boolean;
  onAccountUpdated: (account: AdAccount) => void;
}) {
  const t = useTranslations("adsOverview.billing");
  const fmt = useAdsFormat();
  const billing = state.readiness?.billing;
  const billingPortal = metaPortalUrl(billing?.portalUrl);
  const method = !account.hasFunding ? t("noPaymentMethod") : billing?.paymentMethod || t("paymentMethodHidden");

  return (
    <Panel title={t("title")}>
      <dl className="divide-y divide-border">
        <Fact label={t("paymentMethod")} value={method} />
        {billing ? <Fact label={t("balance")} value={fmt.minor(billing.balance, account.currency)} /> : null}
        {billing ? <Fact label={t("kind")} value={billing.prepay ? t("prepay") : t("postpay")} /> : null}
        <Fact label={t("amountSpent")} value={fmt.minor(account.amountSpent ?? 0, account.currency)} />
      </dl>
      <SpendCapControl account={account} canUpdate={canUpdate} onSaved={onAccountUpdated} />
      {billingPortal ? (
        <ExternalLink href={billingPortal} onOpen={state.openPortal}>
          {t("openBilling")}
        </ExternalLink>
      ) : null}
      {!billing ? <p className="text-xs text-muted-foreground">{t("unavailable")}</p> : null}
    </Panel>
  );
}

function OverviewBody({
  account,
  canCreate,
  canUpdate,
  onAccountUpdated,
}: {
  account: AdAccount;
  canCreate: boolean;
  canUpdate: boolean;
  onAccountUpdated: (account: AdAccount) => void;
}) {
  const readiness = useAdReadiness(account, onAccountUpdated);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ReadinessCard account={account} state={readiness} canCreate={canCreate} />
        <div className="space-y-4">
          <AccountSummary account={account} />
          <BillingSummary account={account} state={readiness} canUpdate={canUpdate} onAccountUpdated={onAccountUpdated} />
        </div>
      </div>
      <PerformanceSection account={account} />
    </div>
  );
}

export function AccountOverview() {
  const t = useTranslations("adsOverview");
  const { can, permissionsLoading } = useWorkspace();
  const searchParams = useSearchParams();
  const canRead = !permissionsLoading && can("ads", "read");
  const canCreate = !permissionsLoading && can("ads", "create");
  const canUpdate = !permissionsLoading && can("ads", "update");
  const accounts = useAdAccounts({ enabled: canRead, requested: searchParams.get("account") });

  const header = (
    <DashboardPageHeader
      badge={t("header.title")}
      description={t("header.description")}
      icon={<SquaresFour className="h-6 w-6" />}
      actions={accounts.selected ? <AccountPicker accounts={accounts.accounts} value={accounts.selected.id} onChange={accounts.select} /> : null}
    />
  );

  return (
    <AccountGate header={header} accounts={accounts} permissionsLoading={permissionsLoading} canRead={canRead} canConnect={canCreate}>
      {(account) => (
        <div className="w-full space-y-4">
          {header}
          <OverviewBody key={account.id} account={account} canCreate={canCreate} canUpdate={canUpdate} onAccountUpdated={accounts.replace} />
        </div>
      )}
    </AccountGate>
  );
}
