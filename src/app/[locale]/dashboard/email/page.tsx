"use client";

import { useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { isActionError } from "@/app/actions/action-result";
import { provisionEmailAction } from "@/app/actions/email-marketing";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { Meter } from "@/components/charts/vozko";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { InstrumentStrip, type Instrument } from "@/components/console/page-shapes";
import { DailySeriesChart } from "@/components/email-marketing/daily-series-chart";
import { DomainSetupNotice } from "@/components/email-marketing/domain-setup-notice";
import { EmailActivation } from "@/components/email-marketing/email-activation";
import { ReputationMeter } from "@/components/email-marketing/reputation-meter";
import { ProbationProgress, SendingLadder } from "@/components/email-marketing/sending-ladder";
import { PausedAccountNotice } from "@/components/email-marketing/paused-account-notice";
import { RepliesPausedNotice } from "@/components/email-marketing/replies-paused-notice";
import { useEmailError } from "@/components/email-marketing/use-email-error";
import Button from "@/components/elevated-design/button";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { ArrowsClockwise, EnvelopeSimple, Globe, Megaphone, Plus } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import { useApplyEmailSetup, useEmailOverview, useEmailSetup } from "@/hooks/use-email-marketing";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import { Link } from "@/i18n/routing";
import { rateFraction } from "@/lib/email-marketing/figures";
import { accountStatusTone, activeDomains, domainStatusTone, hasOwnDomain, usageShare } from "@/lib/email-marketing/ladder";
import { domainsNeedingSetup } from "@/lib/email-marketing/setup-progress";
import type { EmailAccount, EmailCampaignSummary, EmailOverviewDays, EmailSetup } from "@/lib/email-marketing/types";

const DAY_OPTIONS: EmailOverviewDays[] = [7, 30, 90];

function Header({ actions }: { actions?: ReactNode }) {
  const t = useTranslations("emailMarketing.overview");
  return <DashboardPageHeader icon={<EnvelopeSimple weight="fill" />} badge={t("title")} description={t("description")} actions={actions} />;
}

function DomainUsage({ setup }: { setup: EmailSetup }) {
  const t = useTranslations("emailMarketing");
  const format = useFormatter();
  const domains = activeDomains(setup);
  if (domains.length === 0) return <p className="text-sm text-muted-foreground">{t("overview.usage.none")}</p>;
  return (
    <ul className="divide-y divide-border">
      {domains.map((domain) => {
        const share = usageShare(domain);
        return (
          <li key={domain.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-medium text-foreground">{domain.domain}</p>
              <StatusChip tone={domainStatusTone(domain.status)} label={t(`domainStatus.${domain.status}`)} />
            </div>
            {domain.daily_limit === "unlimited" ? (
              <div className="space-y-1">
                <p className="text-xs tabular-nums text-muted-foreground">{t("overview.usage.unlimited", { used: format.number(domain.used_today ?? 0) })}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{t("overview.usage.newDomainGuidance")}</p>
              </div>
            ) : share === null ? (
              <p className="text-xs text-muted-foreground">{t("overview.usage.blocked")}</p>
            ) : (
              <>
                <Meter value={share * 100} label={t("overview.usage.meterLabel", { domain: domain.domain })} color={share >= 1 ? "hsl(var(--destructive))" : "hsl(var(--chart-1))"} />
                <p className="text-xs tabular-nums text-muted-foreground">
                  {t("overview.usage.value", { used: format.number(domain.used_today ?? 0), cap: format.number(domain.cap_today ?? 0) })}
                </p>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ActiveOverview({ setup, account, onRetrySetup }: { setup: EmailSetup; account: EmailAccount; onRetrySetup: () => Promise<void> }) {
  const t = useTranslations("emailMarketing");
  const format = useFormatter();
  const describe = useEmailError();
  const canCreate = useSettledPermission("email_marketing", "create");
  const [days, setDays] = useState<EmailOverviewDays>(30);
  const overview = useEmailOverview(days, true);
  const data = overview.data;
  const totals = data?.totals;
  const reputation = data?.reputation;
  const percent = (basisPoints: number, digits: number) => format.number(rateFraction(basisPoints), { style: "percent", maximumFractionDigits: digits });

  const instruments: Instrument[] = [
    { label: t("overview.kpis.sent"), value: totals ? format.number(totals.sent) : "", detail: totals ? t("overview.kpis.sentDetail", { delivered: format.number(totals.delivered) }) : undefined },
    { label: t("overview.kpis.deliveryRate"), value: totals ? percent(totals.delivery_rate, 1) : "" },
    { label: t("overview.kpis.openRate"), value: totals ? percent(totals.open_rate, 1) : "", detail: totals ? t("overview.kpis.opensDetail", { opens: format.number(totals.opens) }) : undefined },
    { label: t("overview.kpis.clickRate"), value: totals ? percent(totals.click_rate, 1) : "", detail: totals ? t("overview.kpis.clicksDetail", { clicks: format.number(totals.clicks) }) : undefined },
    {
      label: t("overview.kpis.bounceRate"),
      value: totals ? percent(totals.bounce_rate, 2) : "",
      tone: reputation?.bounce_over_limit ? "fault" : "default",
      detail: totals ? t("overview.kpis.bouncesDetail", { hard: format.number(totals.hard_bounces), soft: format.number(totals.soft_bounces) }) : undefined,
    },
    {
      label: t("overview.kpis.complaintRate"),
      value: totals ? percent(totals.complaint_rate, 2) : "",
      tone: reputation?.complaint_over_limit ? "fault" : "default",
      detail: totals ? t("overview.kpis.complaintsDetail", { complaints: format.number(totals.complaints) }) : undefined,
    },
  ];

  const columns: DashboardTableColumn<EmailCampaignSummary>[] = [
    {
      header: t("overview.top.campaign"),
      key: "name",
      render: (row) => (
        <Link href={`/dashboard/email/campaigns/${row.id}`} className="font-medium text-foreground underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {row.name}
        </Link>
      ),
    },
    { header: t("overview.top.sent"), key: "sent", className: "text-right", render: (row) => <span className="tabular-nums">{format.number(row.sent)}</span> },
    { header: t("overview.top.delivered"), key: "delivered", className: "text-right", render: (row) => <span className="tabular-nums">{format.number(row.delivered)}</span> },
    { header: t("overview.top.openRate"), key: "open", className: "text-right", render: (row) => <span className="tabular-nums">{percent(row.open_rate, 1)}</span> },
    { header: t("overview.top.clickRate"), key: "click", className: "text-right", render: (row) => <span className="tabular-nums">{percent(row.click_rate, 1)}</span> },
  ];

  const ownDomain = hasOwnDomain(setup);
  const unverified = activeDomains(setup).filter((domain) => !domain.sendable && domain.kind !== "own" && domain.setup.state === "done");

  return (
    <main className="w-full space-y-5">
      <Header
        actions={
          <>
            {canCreate ? (
              <Button link="/dashboard/email/campaigns/new" newTab={false} icon={<Plus className="h-4 w-4" weight="bold" />} iconVisible title={t("overview.actions.newCampaign")} />
            ) : null}
            {ownDomain ? null : (
              <Button link="/dashboard/email/senders" newTab={false} variant="outline" icon={<Globe className="h-4 w-4" weight="bold" />} iconVisible title={t("overview.actions.connectDomain")} />
            )}
            <Button link="/dashboard/email/campaigns" newTab={false} variant="command" icon={<Megaphone className="h-4 w-4" weight="bold" />} iconVisible title={t("overview.actions.campaigns")} />
          </>
        }
      />

      <PausedAccountNotice account={account} />
      <RepliesPausedNotice setup={setup} />
      {domainsNeedingSetup(setup).map((domain) => (
        <DomainSetupNotice key={domain.id} domain={domain} onRetry={onRetrySetup} />
      ))}
      {unverified.map((domain) => (
        <Notice key={domain.id} tone="info" title={t("overview.verifyingTitle", { domain: domain.domain })}>
          <p>{t(`overview.verifyingText.${domain.status}`)}</p>
        </Notice>
      ))}

      {overview.isError ? (
        <Notice tone="fault" title={t("overview.loadFailed")}>
          <p>{describe(overview.error)}</p>
          <Button variant="outline" size="sm" icon={<ArrowsClockwise className="h-3.5 w-3.5" weight="bold" />} iconVisible title={t("common.retry")} onClick={() => void overview.refetch()} />
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="legend">{t("overview.window", { days })}</p>
        <ElevatedPillToggle
          size="sm"
          aria-label={t("overview.window", { days })}
          value={String(days)}
          onChange={(value) => setDays(Number(value) as EmailOverviewDays)}
          options={DAY_OPTIONS.map((option) => ({ value: String(option), label: t("overview.daysOption", { days: option }) }))}
        />
      </div>

      <InstrumentStrip instruments={instruments} loading={overview.isPending} columns={3} />

      <div className="grid gap-6 lg:grid-cols-3">
        <PanelSection className="lg:col-span-2" title={t("overview.chart.title")} description={t("overview.chart.description", { days })}>
          <DailySeriesChart daily={data?.daily ?? []} timeZone={data?.time_zone} loading={overview.isPending} />
        </PanelSection>

        <PanelSection title={t("overview.reputation.title")} description={t("overview.reputation.description")}>
          {reputation ? (
            <div className="space-y-5">
              <ReputationMeter
                label={t("overview.reputation.bounce")}
                rate={reputation.bounce_rate}
                warning={reputation.bounce_warning}
                limit={reputation.bounce_limit}
                level={reputation.bounce_level}
              />
              <ReputationMeter
                label={t("overview.reputation.complaint")}
                rate={reputation.complaint_rate}
                warning={reputation.complaint_warning}
                limit={reputation.complaint_limit}
                level={reputation.complaint_level}
              />
            </div>
          ) : (
            <div className="h-40 animate-pulse rounded-md bg-muted" />
          )}
        </PanelSection>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <PanelSection
          className="lg:col-span-2"
          title={
            <span className="inline-flex items-center gap-1.5">
              {t("overview.ladder.title")}
              <ExplainerHint id="email.ladder" />
            </span>
          }
          actions={<StatusChip tone={accountStatusTone(account.status)} label={t(`accountStatus.${account.status}`)} />}
        >
          <div className="space-y-5">
            <SendingLadder account={account} />
            {setup.probation ? <ProbationProgress probation={setup.probation} /> : null}
          </div>
        </PanelSection>

        <PanelSection title={t("overview.usage.title")} description={t("overview.usage.description")}>
          <DomainUsage setup={setup} />
        </PanelSection>
      </div>

      <PanelSection title={t("overview.top.title")} description={t("overview.top.description", { days })}>
        <DashboardTable<EmailCampaignSummary>
          data={data?.top ?? []}
          columns={columns}
          rowKey={(row) => row.id}
          loading={overview.isPending}
          emptyState={{
            icon: <Megaphone className="h-7 w-7 text-muted-foreground" weight="fill" />,
            title: t("overview.top.emptyTitle"),
            description: t("overview.top.emptyText"),
            action: canCreate ? <Button link="/dashboard/email/campaigns/new" newTab={false} title={t("overview.actions.newCampaign")} /> : undefined,
          }}
        />
      </PanelSection>
    </main>
  );
}

export default function EmailOverviewPage() {
  const t = useTranslations("emailMarketing");
  const describe = useEmailError();
  const setup = useEmailSetup();
  const applySetup = useApplyEmailSetup();

  const retrySetup = async () => {
    const result = await provisionEmailAction();
    if (isActionError(result)) {
      toast.error(describe(result));
      return;
    }
    applySetup(result.data);
  };

  if (setup.isPending) return <ScreenLoader fit="screen" />;

  if (setup.isError) {
    return (
      <main className="w-full space-y-5">
        <Header />
        <Notice tone="fault" title={t("overview.setupFailed")}>
          <p>{describe(setup.error)}</p>
          <Button variant="outline" size="sm" title={t("common.retry")} onClick={() => void setup.refetch()} />
        </Notice>
      </main>
    );
  }

  const account = setup.data.account;
  if (!setup.data.provisioned || !account) {
    return (
      <main className="w-full space-y-5">
        <Header />
        <EmailActivation subdomain={setup.data.subdomain} activation={setup.data.activation} />
      </main>
    );
  }

  return <ActiveOverview setup={setup.data} account={account} onRetrySetup={retrySetup} />;
}
