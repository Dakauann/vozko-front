"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";

import { getAdEditableObjectAction } from "@/app/actions/advertising";
import Button from "@/components/elevated-design/button";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";
import { ArrowRight, CheckCircle } from "@/components/icons";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { formatDay } from "@/lib/advertising/date-range";
import { rowIssues } from "@/lib/advertising/delivery";
import { creativeSwapForm } from "@/lib/advertising/editor-form";
import { budgetHome, insightsTabs, type InsightsTab } from "@/lib/advertising/manager-insights";
import type { TableRow } from "@/lib/advertising/manager-drafts";
import type { AdAccount, AdBudgetMinimum, AdLevel, AdRange, AdRow } from "@/lib/advertising/types";

import { BudgetCell } from "../budget-cell";
import { PublishedAdPreview } from "../editor/published-ad-preview";
import { DeliveryStatus } from "../status-dot";
import { useAdsFormat } from "../use-ads-format";
import { useAdsResource } from "../wizard/use-ads-resource";
import { AdComments } from "./ad-comments";
import { InsightsHistory } from "./insights-history";
import { InsightsPerformance } from "./insights-performance";
import { RowIssueList } from "./name-cell";
import { RowSwitch } from "./row-switch";
import { SyncFreshness } from "./sync-freshness";

export interface InsightsChain {
  campaign?: AdRow;
  adSet?: AdRow;
}

export interface InsightsPanelProps {
  account: AdAccount;
  row: TableRow | null;
  chain: InsightsChain;
  range: AdRange | null;
  permissions: { canStart: boolean; canStop: boolean; canUpdate: boolean };
  busy: boolean;
  onToggle: (row: AdRow, on: boolean) => void;
  onBudget: (row: AdRow, amount: number, minimum: AdBudgetMinimum | null) => Promise<string | null>;
  onOpen: (level: AdLevel, metaId: string) => void;
  onShowAdSets: (campaignId: string) => void;
  onClose: () => void;
  synced: string | null;
  syncing: boolean;
  onSync: () => void;
}

function Budget({
  account,
  row,
  chain,
  canUpdate,
  onBudget,
  onOpen,
  onShowAdSets,
}: Pick<InsightsPanelProps, "account" | "chain" | "onBudget" | "onOpen" | "onShowAdSets"> & { row: AdRow; canUpdate: boolean }) {
  const t = useTranslations("adsManager.insights.budget");
  const tLevel = useTranslations("adsManager.insights.level");
  const home = budgetHome(row, chain.adSet);
  if (home.kind === "own") {
    return (
      <div className="rounded-[--radius] border border-border p-4">
        <BudgetCell
          dailyBudget={row.dailyBudget}
          lifetimeBudget={row.lifetimeBudget}
          currency={row.metrics.currency || account.currency}
          editable={canUpdate && row.level !== "ad"}
          minimumQuery={row.level === "adset" && row.optimizationGoal ? { accountId: account.id, goal: row.optimizationGoal } : null}
          onSave={(amount, minimum) => onBudget(row, amount, minimum)}
        />
      </div>
    );
  }
  const action =
    home.kind === "parent" ? (
      <Button
        variant="outline"
        size="sm"
        title={t("goTo", { level: tLevel(home.level) })}
        icon={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}
        iconSide="right"
        onClick={() => onOpen(home.level, home.metaId)}
      />
    ) : home.kind === "children" ? (
      <Button
        variant="outline"
        size="sm"
        title={t("goToAdSets")}
        icon={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}
        iconSide="right"
        onClick={() => onShowAdSets(row.metaId)}
      />
    ) : null;
  return (
    <div className="space-y-3 rounded-[--radius] border border-dashed border-border p-4">
      <p className="text-sm font-semibold text-foreground">{t("unavailable")}</p>
      <p className="text-sm text-muted-foreground">{t(home.kind === "children" ? "onAdSets" : home.kind === "parent" ? `on.${home.level}` : "unknown")}</p>
      {action}
    </div>
  );
}

function Actions({ row }: { row: AdRow }) {
  const t = useTranslations("adsManager.insights.actions");
  const issues = rowIssues(row);
  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[--radius] border border-dashed border-border px-4 py-10 text-center">
        <CheckCircle className="h-6 w-6 text-success-ink" aria-hidden />
        <p className="text-sm font-semibold text-foreground">{t("emptyTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("emptyBody")}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">{t("title", { count: issues.length })}</p>
      <RowIssueList issues={issues} className="rounded-[--radius] border border-border p-4" />
    </div>
  );
}

function Preview({ account, row, chain }: { account: AdAccount; row: AdRow; chain: InsightsChain }) {
  const t = useTranslations("adsManager.insights");
  const detail = useAdsResource(`object:${row.metaId}`, () => getAdEditableObjectAction(row.metaId));
  if (detail.status === "loading" || detail.status === "idle") return <div className="h-64 animate-pulse rounded-[--radius] bg-muted" />;
  if (detail.status === "error") return <p className="text-sm text-destructive-ink">{detail.message}</p>;
  const form = creativeSwapForm(detail.data, account.id, chain.campaign ?? null, chain.adSet ?? null);
  if (!form) return <p className="text-sm text-muted-foreground">{t("noCreative")}</p>;
  return <PublishedAdPreview accountId={account.id} form={form} />;
}

export function InsightsPanel(props: InsightsPanelProps) {
  const { account, row, chain, range, permissions, busy, onToggle, onClose } = props;
  const t = useTranslations("adsManager.insights");
  const fmt = useAdsFormat();
  const [tab, setTab] = useState<InsightsTab>("performance");
  const [shownFor, setShownFor] = useState<string | null>(null);
  if (row && shownFor !== row.metaId) {
    setShownFor(row.metaId);
    setTab("performance");
  }
  const crumbs = [chain.campaign, chain.adSet, row].filter((entry): entry is AdRow => !!entry);
  const tabs = row ? insightsTabs(row.level) : [];

  return (
    <ElevatedSheet open={!!row} onOpenChange={(open) => !open && onClose()}>
      <ElevatedSheetContent side="right" className="flex w-full flex-col overflow-x-hidden sm:max-w-3xl">
        {row ? (
          <>
            <ElevatedSheetHeader className="space-y-3">
              <Breadcrumb className="pr-10">
                <BreadcrumbList>
                  {crumbs.map((crumb, index) => (
                    <Fragment key={crumb.metaId}>
                      {index > 0 ? <BreadcrumbSeparator /> : null}
                      <BreadcrumbItem className={crumb.metaId === row.metaId ? "font-semibold text-foreground" : undefined}>{crumb.name || crumb.metaId}</BreadcrumbItem>
                    </Fragment>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
              <div className="flex items-center justify-between gap-3">
                <ElevatedSheetTitle className="truncate text-xl">{row.name || row.metaId}</ElevatedSheetTitle>
                <div className="flex shrink-0 items-center gap-3">
                  <DeliveryStatus delivery={row.delivery} delivered={row.delivered} />
                  <RowSwitch row={row} account={account} permissions={permissions} busy={busy} onToggle={onToggle} />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <ElevatedSheetDescription>{range ? t("range", { since: formatDay(range.since, fmt.tag), until: formatDay(range.until, fmt.tag) }) : null}</ElevatedSheetDescription>
                <SyncFreshness synced={props.synced} syncing={props.syncing} onSync={props.onSync} />
              </div>
              <Tabs value={tab} onValueChange={(value) => setTab(value as InsightsTab)}>
                <TabsList>
                  {tabs.map((value) => (
                    <TabsTrigger key={value} value={value}>
                      {t(`tabs.${value}`)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </ElevatedSheetHeader>
            <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-6 pb-6">
              {tab === "performance" ? <InsightsPerformance account={account} row={row} range={range} /> : null}
              {tab === "history" ? <InsightsHistory account={account} row={row} range={range} /> : null}
              {tab === "budget" ? (
                <Budget
                  account={account}
                  row={row}
                  chain={chain}
                  canUpdate={permissions.canUpdate}
                  onBudget={props.onBudget}
                  onOpen={props.onOpen}
                  onShowAdSets={props.onShowAdSets}
                />
              ) : null}
              {tab === "actions" ? <Actions row={row} /> : null}
              {tab === "preview" ? <Preview account={account} row={row} chain={chain} /> : null}
              {tab === "comments" ? <AdComments metaId={row.metaId} /> : null}
            </div>
          </>
        ) : null}
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
