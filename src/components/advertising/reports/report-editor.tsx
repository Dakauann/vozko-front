"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { isAdsError } from "@/app/actions/advertising";
import {
  createAdReportExportAction,
  createAdSavedReportAction,
  downloadAdReportExportAction,
  getAdSavedReportAction,
  updateAdSavedReportAction,
} from "@/app/actions/advertising-reports";
import Button from "@/components/elevated-design/button";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { DashboardTable } from "@/components/elevated-design/table/dashboard-table";
import { ArrowClockwise, CaretLeft, ChartBar, ChartLine, DownloadSimple, FloppyDisk, SlidersHorizontal, Table, Warning } from "@/components/icons";
import { useAdAccounts } from "@/hooks/use-ad-accounts";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "@/i18n/routing";
import { reportHref } from "@/lib/advertising/connect";
import { civilToday } from "@/lib/advertising/date-range";
import {
  BLANK_REPORT_DEFINITION,
  customDays,
  isReportDirty,
  reportInput,
  reportRange,
  reportRunRequest,
  reportsListHref,
  resolveTemplate,
  trendMetrics,
  withRange,
  withView,
  type ReportDraft,
} from "@/lib/advertising/reports";
import { exportLabels, hasReportData } from "@/lib/advertising/reports-run";
import type { AdAccount, AdReportDefinition, AdReportOptions, AdReportRun, AdReportRunRequest, AdReportView } from "@/lib/advertising/types";
import { cn } from "@/lib/utils";

import { AccountGate } from "../account-gate";
import { AccountPicker } from "../account-picker";
import { AdsDateRangePicker } from "../ads-date-range-picker";
import { useAdsResource, type Resource } from "../wizard/use-ads-resource";
import { useReportOptions } from "./use-report-options";
import { ReportBars } from "./report-bars";
import { ReportCustomizePanel } from "./report-customize-panel";
import { ReportPivotTable } from "./report-pivot-table";
import { useTemplateText } from "./report-templates";
import { ReportTrend } from "./report-trend";
import { useReportPermissions, type ReportPermissions } from "./use-report-permissions";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";
import { useReportLabels } from "./use-report-labels";
import { useReportRun } from "./use-report-run";

export type ReportEntry = { kind: "new"; templateKey: string | null; accountId: string | null } | { kind: "saved"; reportId: string };

interface ReportSource {
  savedId: string | null;
  name: string;
  accountId: string | null;
  definition: AdReportDefinition;
  options: AdReportOptions;
}

const VIEW_ICONS: Record<AdReportView, typeof Table> = { pivot: Table, trend: ChartLine, bars: ChartBar };

function useReportSource(entry: ReportEntry, enabled: boolean): Resource<ReportSource> | { status: "missing" } {
  const t = useTranslations("adsReports");
  const templateText = useTemplateText();
  const savedId = entry.kind === "saved" ? entry.reportId : null;
  const templateKey = entry.kind === "new" ? entry.templateKey : null;

  const saved = useAdsResource(enabled && savedId ? `report:${savedId}` : null, () => getAdSavedReportAction(savedId ?? ""));
  const options = useReportOptions(enabled);

  if (options.status !== "ready") return options;
  if (entry.kind === "saved") {
    if (saved.status !== "ready") return saved;
    return {
      status: "ready",
      data: {
        savedId: saved.data.id,
        name: saved.data.name,
        accountId: saved.data.adAccountId,
        definition: saved.data.definition,
        options: options.data,
      },
    };
  }
  if (!templateKey) {
    return {
      status: "ready",
      data: { savedId: null, name: t("editor.untitled"), accountId: entry.accountId, definition: BLANK_REPORT_DEFINITION, options: options.data },
    };
  }
  const template = resolveTemplate(options.data.templates, templateKey);
  if (!template) return { status: "missing" };
  return {
    status: "ready",
    data: { savedId: null, name: templateText(template.key).title, accountId: entry.accountId, definition: template.definition, options: options.data },
  };
}

function Notice({ tone = "neutral", children, action }: { tone?: "neutral" | "error"; children: ReactNode; action?: ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-[--radius] border border-border bg-muted px-4 py-3 text-sm",
        tone === "error" ? "text-destructive-ink" : "text-muted-foreground",
      )}
    >
      {tone === "error" ? <Warning className="h-4 w-4 flex-shrink-0" aria-hidden /> : null}
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

function EmptyData({ title, description }: { title: string; description?: string }) {
  return (
    <DashboardTable
      data={[]}
      columns={[]}
      rowKey={() => ""}
      emptyState={{ icon: <ChartBar className="h-7 w-7 text-muted-foreground" />, title, description }}
    />
  );
}

function ReportWorkspace({
  initial,
  initialAccount,
  accounts,
  permissions,
}: {
  initial: ReportSource;
  initialAccount: AdAccount;
  accounts: AdAccount[];
  permissions: ReportPermissions;
}) {
  const t = useTranslations("adsReports.editor");
  const router = useRouter();
  const { toast } = useToast();
  const labels = useReportLabels();
  const [now] = useState(() => new Date());
  const [savedId, setSavedId] = useState(initial.savedId);
  const [baseline, setBaseline] = useState<ReportDraft>({ name: initial.name, adAccountId: initialAccount.id, definition: initial.definition });
  const [draft, setDraft] = useState<ReportDraft>(baseline);
  const [panelOpen, setPanelOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [account, setAccount] = useState<AdAccount>(initialAccount);

  const definition = draft.definition;
  const changed = isReportDirty(baseline, draft);
  const dirty = savedId === null || changed;
  const canSave = savedId ? permissions.canUpdate : permissions.canCreate;
  const today = civilToday(account.timezone, now);
  const range = reportRange(definition, today);
  const chartMetrics = trendMetrics(definition.metrics, initial.options.trendMetrics);
  const request = reportRunRequest(definition, range, initial.options.trendMetrics);
  const run = useReportRun(account.id, request, refreshToken);
  const result = run.status === "ready" ? run.data : null;

  useEffect(() => {
    if (!changed) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed]);

  const updateDefinition = (next: AdReportDefinition) => setDraft((value) => ({ ...value, definition: next }));

  const save = async (): Promise<boolean> => {
    if (!canSave) return false;
    setSaving(true);
    const input = reportInput(draft, t("untitled"));
    const outcome = savedId ? await updateAdSavedReportAction(savedId, input) : await createAdSavedReportAction(input);
    setSaving(false);
    if (isAdsError(outcome)) {
      toast({ title: t("saveFailed"), description: outcome.error, variant: "destructive" });
      return false;
    }
    const stored: ReportDraft = { name: outcome.data.name, adAccountId: outcome.data.adAccountId, definition: outcome.data.definition };
    setBaseline(stored);
    setDraft(stored);
    toast({ title: t("saved") });
    if (!savedId) {
      setSavedId(outcome.data.id);
      router.replace(reportHref(outcome.data.id));
    }
    return true;
  };

  const leave = () => router.push(reportsListHref(account.id, "reports"));

  const requestLeave = () => {
    if (changed) setLeaving(true);
    else leave();
  };

  const exportReport = async (shown: AdReportRun, asked: AdReportRunRequest) => {
    setExporting(true);
    const created = await createAdReportExportAction({
      ...asked,
      name: reportInput(draft, t("untitled")).name,
      adAccountId: account.id,
      reportId: savedId ?? undefined,
      labels: exportLabels(shown, labels.exportTexts(definition.level)),
    });
    if (isAdsError(created)) {
      setExporting(false);
      toast({ title: t("exportFailed"), description: created.error, variant: "destructive" });
      return;
    }
    const downloaded = await downloadAdReportExportAction(created.data);
    setExporting(false);
    if (isAdsError(downloaded)) {
      toast({ title: t("exportDownloadFailed"), description: downloaded.error, variant: "destructive" });
      return;
    }
    toast({ title: t("exported"), description: t("exportedBody") });
  };

  const exportable = !!request && !!result && hasReportData(result) && !exporting;

  const body = () => {
    if (!range) return <Notice>{t("noRange")}</Notice>;
    if (definition.metrics.length === 0) return <Notice>{t("noMetrics")}</Notice>;
    if (definition.view === "trend" && chartMetrics.length === 0) return <Notice>{t("trendNoMetrics")}</Notice>;
    if (run.status === "error")
      return (
        <Notice
          tone="error"
          action={
            <button type="button" onClick={() => setRefreshToken((token) => token + 1)} className="font-semibold text-primary-ink hover:underline">
              {t("refresh")}
            </button>
          }
        >
          {t("loadFailed")}: {run.message}
        </Notice>
      );
    if (!result) return <div className="h-72 animate-pulse rounded-[--radius] bg-muted" />;
    if (!hasReportData(result)) return <EmptyData title={t("noData")} description={t("noDataBody")} />;
    if (result.view === "trend") return <ReportTrend metrics={chartMetrics} run={result} labels={labels} />;
    if (result.view === "bars") return <ReportBars run={result} level={definition.level} labels={labels} />;
    return <ReportPivotTable run={result} level={definition.level} labels={labels} />;
  };

  return (
    <div className="w-full space-y-4">
      <header className="space-y-3 rounded-[--radius] border border-border bg-card p-4 shadow-sm">
        <button
          type="button"
          onClick={requestLeave}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CaretLeft className="h-4 w-4" weight="bold" aria-hidden />
          {t("back")}
        </button>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={draft.name}
              onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))}
              placeholder={t("untitled")}
              aria-label={t("titleLabel")}
              className="min-w-0 flex-1 rounded-[--radius] border border-transparent bg-transparent px-2 py-1 font-display text-xl font-semibold text-foreground hover:border-border focus:border-control-edge focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <AccountPicker
              accounts={accounts}
              value={account.id}
              onChange={(adAccountId) => {
                const next = accounts.find((candidate) => candidate.id === adAccountId);
                if (!next) return;
                setAccount(next);
                setDraft((value) => ({ ...value, adAccountId: next.id }));
              }}
              className="sm:w-64"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              title={t("refresh")}
              icon={<ArrowClockwise className={cn("h-4 w-4", run.status === "loading" && "animate-spin")} />}
              iconVisible
              iconSide="left"
              onClick={() => setRefreshToken((token) => token + 1)}
              disabled={run.status === "loading" || !request}
            />
            <Button
              variant="secondary"
              title={t("export")}
              icon={<DownloadSimple className="h-4 w-4" />}
              iconVisible
              iconSide="left"
              onClick={() => {
                if (result && request) void exportReport(result, request);
              }}
              disabled={!exportable}
            />
            {canSave ? (
              <Button
                variant="primary"
                title={t("save")}
                icon={<FloppyDisk className="h-4 w-4" />}
                iconVisible
                iconSide="left"
                onClick={() => void save()}
                disabled={saving || !dirty}
              />
            ) : null}
          </div>
        </div>
      </header>

      {!canSave ? <Notice>{t("readOnly")}</Notice> : null}

      <div className="flex flex-col gap-3 rounded-[--radius] border border-border bg-card px-4 py-3 shadow-sm md:flex-row md:flex-wrap md:items-center">
        <ElevatedPillToggle<AdReportView>
          aria-label={t("viewLabel")}
          value={definition.view}
          onChange={(view) => updateDefinition(withView(definition, view, initial.options.trendMetrics))}
          options={initial.options.views.map((view) => {
            const Icon = VIEW_ICONS[view];
            return { value: view, label: t(`views.${view}`), icon: <Icon className="h-3.5 w-3.5" weight="bold" /> };
          })}
        />
        <div className="flex flex-wrap items-center gap-2 md:ml-auto">
          <AdsDateRangePicker
            value={{ preset: definition.datePreset, custom: customDays(definition), comparing: false }}
            today={today}
            timezone={account.timezone}
            onApply={(choice) => updateDefinition(withRange(definition, choice.preset, choice.custom))}
          />
          <Button
            variant={panelOpen ? "primary" : "secondary"}
            title={t("customize")}
            icon={<SlidersHorizontal className="h-4 w-4" />}
            iconVisible
            iconSide="left"
            aria-pressed={panelOpen}
            onClick={() => setPanelOpen((open) => !open)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="order-2 min-w-0 flex-1 lg:order-1">{body()}</div>
        {panelOpen ? (
          <div className="order-1 lg:order-2 lg:w-80 lg:flex-shrink-0">
            <ReportCustomizePanel definition={definition} options={initial.options} labels={labels} onChange={updateDefinition} onClose={() => setPanelOpen(false)} />
          </div>
        ) : null}
      </div>

      <UnsavedChangesDialog
        open={leaving}
        canSave={canSave}
        saving={saving}
        onDiscard={leave}
        onCancel={() => setLeaving(false)}
        onSave={() =>
          void save().then((ok) => {
            if (ok) leave();
          })
        }
      />
    </div>
  );
}

export function ReportEditor({ entry }: { entry: ReportEntry }) {
  const t = useTranslations("adsReports");
  const permissions = useReportPermissions();
  const source = useReportSource(entry, permissions.canRead);
  const ready = source.status === "ready" ? source.data : null;
  const accounts = useAdAccounts({ enabled: permissions.canRead && !!ready, requested: ready?.accountId ?? null });
  const header = <h1 className="sr-only">{t("header.title")}</h1>;

  if (source.status === "missing") {
    return <EmptyData title={t("editor.templateMissing")} description={t("editor.templateMissingBody")} />;
  }
  if (source.status === "error") {
    return <Notice tone="error">{t("editor.reportMissing")}: {source.message}</Notice>;
  }

  return (
    <AccountGate
      header={header}
      accounts={accounts}
      permissionsLoading={permissions.loading || (permissions.canRead && !ready)}
      canRead={permissions.canRead}
      canConnect={permissions.canCreate}
    >
      {(selected) => {
        if (!ready) return null;
        const account = ready.savedId ? accounts.accounts.find((candidate) => candidate.id === ready.accountId) : selected;
        if (!account) return <Notice tone="error">{t("editor.reportMissing")}</Notice>;
        return (
          <ReportWorkspace
            key={ready.savedId ?? "new"}
            initial={ready}
            initialAccount={account}
            accounts={accounts.accounts}
            permissions={permissions}
          />
        );
      }}
    </AccountGate>
  );
}
