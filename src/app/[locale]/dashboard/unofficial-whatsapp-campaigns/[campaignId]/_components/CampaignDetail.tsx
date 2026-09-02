"use client";

import {
  CalendarCheck,
  CaretDown,
  ChatCircle,
  CheckCircle,
  DownloadSimple,
  ListDashes,
  UserCircle,
  Warning,
} from "@/components/icons";
import { useCallback, useEffect, useState, useTransition } from "react";

import Button from "@/components/elevated-design/button";
import { CampaignConfirmModal } from "@/components/campaigns/CampaignConfirmModal";
import CrmDialog from "@/components/crm/CrmDialog";
import CampaignHeader from "@/components/dashboard/CampaignHeader";
import { CampaignMetricsTiles } from "@/components/campaigns/CampaignMetricsTiles";
import { WhatsappLogo } from "@/components/icons";
import { channelPlate } from "@/components/channels/channel-tile";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { cn } from "@/lib/utils";
import EntryConversationDialog from "@/components/dashboard/EntryConversationDialog";
import EntryFiltersBar, {
  type EntryFilterValues,
} from "@/components/dashboard/EntryFiltersBar";
import type {
  UnofficialWhatsAppCampaign,
  UnofficialWhatsAppCampaignEntry,
} from "@/lib/unofficial-whatsapp-campaigns/types";
import { UNOFFICIAL_SEND_STATUSES, canPause, canStart, canStop } from "@/lib/unofficial-whatsapp-campaigns/statuses";
import {
  confirmClearHistoryUnofficialCampaignAction,
  confirmResetUnofficialCampaignAction,
  getUnofficialCampaignAction,
  listUnofficialCampaignEntriesAction,
  pauseUnofficialCampaignAction,
  prepareClearHistoryUnofficialCampaignAction,
  prepareResetUnofficialCampaignAction,
  startUnofficialCampaignAction,
  stopUnofficialCampaignAction,
  exportUnofficialCampaignEntriesAction,
  validateUnofficialCampaignTargetsAction,
} from "@/app/actions/unofficial-whatsapp-campaigns";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

/**
 * Entry status plates, matching the Cloud API campaign's detail page exactly.
 *
 * Solid grounds with a foreground colour, and the dot inherits `currentColor`,
 * so a status reads the same on both products. SKIPPED_NOT_ON_WHATSAPP shares
 * the warning plate with the spam skip because it is the same KIND of outcome:
 * nothing was sent, and nothing went wrong.
 */
const entryStatusStyles: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  SENT: "bg-primary text-primary-foreground",
  DELIVERED: "bg-healthy text-healthy-foreground",
  READ: "bg-healthy text-healthy-foreground",
  FAILED: "bg-destructive text-destructive-foreground",
  NOT_ELIGIBLE_POSSIBLE_SPAM: "bg-warning text-warning-foreground",
  SKIPPED_NOT_ON_WHATSAPP: "bg-warning text-warning-foreground",
};

const entryStatusKeys: Record<string, string> = {
  PENDING: "pending",
  SENT: "sent",
  DELIVERED: "delivered",
  READ: "read",
  FAILED: "failed",
  NOT_ELIGIBLE_POSSIBLE_SPAM: "notEligiblePossibleSpam",
  SKIPPED_NOT_ON_WHATSAPP: "skippedNotOnWhatsApp",
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const ENTRIES_PAGE_SIZE = 25;
/** Live enough to watch a run without hammering the API. */
const REFRESH_MS = 5000;

export default function UnofficialCampaignDetail({
  campaign: initial,
}: {
  campaign: UnofficialWhatsAppCampaign;
}) {
  const t = useTranslations("unofficialWhatsappCampaigns");
  // The CRM strings are the shared ones: the dialog is the same product.
  const tCrm = useTranslations("crm");
  // The transport badge reuses the spine's own wording and hint, so the two
  // surfaces cannot describe the same distinction differently.
  const tSidebar = useTranslations("sidebar");
  const { toast } = useToast();
  const { can } = useWorkspace();
  const [pending, startTransition] = useTransition();

  const [campaign, setCampaign] = useState(initial);
  const [entries, setEntries] = useState<UnofficialWhatsAppCampaignEntry[]>([]);
  const [entriesMeta, setEntriesMeta] = useState({ page: 1, totalPages: 1, totalItems: 0 });
  const [entriesPage, setEntriesPage] = useState(1);
  const [entryFilters, setEntryFilters] = useState<EntryFilterValues>({
    search: "",
    status: "",
    stageId: "",
    errorCode: "",
  });
  const [entriesLoading, setEntriesLoading] = useState(true);

  const [resetCode, setResetCode] = useState<string | undefined>();
  const [clearCode, setClearCode] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    const result = await getUnofficialCampaignAction(campaign.id);
    if (result.campaign) setCampaign(result.campaign);
  }, [campaign.id]);

  const fetchEntries = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const result = await listUnofficialCampaignEntriesAction(campaign.id, {
        page: entriesPage,
        pageSize: ENTRIES_PAGE_SIZE,
        status: entryFilters.status || undefined,
        search: entryFilters.search || undefined,
      });
      setEntries(result.entries);
      setEntriesMeta({
        page: result.meta.page,
        totalPages: result.meta.totalPages,
        totalItems: result.meta.totalItems,
      });
    } finally {
      setEntriesLoading(false);
    }
  }, [campaign.id, entriesPage, entryFilters.status, entryFilters.search]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Poll only while there is something to watch. A COMPLETED campaign cannot
  // change on its own, and polling one is a request every five seconds that can
  // never return anything new.
  useEffect(() => {
    if (campaign.status !== "RUNNING") return;
    const timer = setInterval(() => {
      refresh();
      fetchEntries();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [campaign.status, refresh, fetchEntries]);

  const act = (
    action: () => Promise<{ error?: string }>,
    successKey: string,
  ) =>
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast({
          title: t("actions.failed"),
          description: result.error,
          variant: "destructive",
        });
        return;
      }
      toast({ title: t(successKey) });
      await refresh();
      await fetchEntries();
    });

  const [showCrmDialog, setShowCrmDialog] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      // The CURRENT filters ride with the export, so the file matches what is
      // on screen. An export that silently ignored the filters would hand an
      // operator a different set from the one they were looking at.
      const result = await exportUnofficialCampaignEntriesAction(campaign.id, {
        status: entryFilters.status || undefined,
        search: entryFilters.search || undefined,
      });
      if (result.error || !result.csvText) {
        toast({
          title: t("actions.failed"),
          description: t(`entries.exportError.${result.error ?? "generic"}`),
          variant: "destructive",
        });
        return;
      }
      const url = URL.createObjectURL(
        new Blob([result.csvText], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename || `${campaign.name}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const canUpdate = can("unofficial_whatsapp_campaigns", "update");
  const canRunStart = can("unofficial_whatsapp_campaigns", "start");
  const canRunStop = can("unofficial_whatsapp_campaigns", "stop");

  return (
    <main className="w-full space-y-4">
      <CampaignHeader
        name={campaign.name}
        status={campaign.status}
        campaignType="unofficial_whatsapp"
        backLink="/dashboard/unofficial-whatsapp-campaigns"
        editLink={`/dashboard/unofficial-whatsapp-campaigns/${campaign.id}/edit`}
        isPending={pending}
        // A number that cannot send must not offer Start: the button would only
        // ever produce the restriction error the banner above already explains.
        canStart={canStart(campaign.status) && campaign.instanceSessionLive}
        canPause={canPause(campaign.status)}
        canStop={canStop(campaign.status)}
        canReset={campaign.status !== "RUNNING"}
        hasPermissionStart={canRunStart}
        hasPermissionStop={canRunStop}
        // The pre-flight list clean has no counterpart on the official campaign,
        // so it rides in the actions menu rather than as a row of its own.
        extraActions={
          canUpdate
            ? (close) => (
                <Button
                  variant="ghost"
                  title={t("actions.validate")}
                  icon={<CheckCircle weight="bold" className="h-4 w-4" />}
                  iconVisible
                  iconSide="left"
                  disabled={pending}
                  className="w-full justify-start rounded-lg text-sm text-foreground"
                  onClick={() => {
                    close();
                    startTransition(async () => {
                      const result = await validateUnofficialCampaignTargetsAction(
                        campaign.id,
                      );
                      if (result.error) {
                        toast({
                          title: t("actions.failed"),
                          description: result.error,
                          variant: "destructive",
                        });
                        return;
                      }
                      toast({
                        title: t("actions.validated"),
                        description: t("actions.validatedDetail", {
                          checked: result.result?.checked ?? 0,
                          skipped: result.result?.skipped ?? 0,
                        }),
                      });
                      await fetchEntries();
                      await refresh();
                    });
                  }}
                />
              )
            : undefined
        }
        transportBadge={{
          label: tSidebar("families.badges.unofficial"),
          hint: tSidebar("families.badges.unofficialHint"),
        }}
        hasPermissionUpdate={canUpdate}
        hasActiveSubscription
        onShowCrm={() => setShowCrmDialog(true)}
        onReset={() =>
          startTransition(async () => {
            const result = await prepareResetUnofficialCampaignAction(campaign.id);
            if (result.error) {
              toast({ title: t("actions.failed"), description: result.error, variant: "destructive" });
              return;
            }
            setResetCode(result.data?.resetCode);
          })
        }
        onClearHistory={() =>
          startTransition(async () => {
            const result = await prepareClearHistoryUnofficialCampaignAction(campaign.id);
            if (result.error) {
              toast({ title: t("actions.failed"), description: result.error, variant: "destructive" });
              return;
            }
            setClearCode(result.data?.clearCode);
          })
        }
        onLifecycle={(action) => {
          if (action === "start") {
            act(() => startUnofficialCampaignAction(campaign.id), "actions.started");
            return;
          }
          if (action === "pause") {
            act(() => pauseUnofficialCampaignAction(campaign.id), "actions.paused");
            return;
          }
          act(() => stopUnofficialCampaignAction(campaign.id), "actions.stopped");
        }}
        translations={{
          back: t("form.back"),
          badge: t("detail.badge"),
          crm: t("actions.crm"),
          edit: t("actions.edit"),
          reset: t("danger.reset"),
          clearHistory: t("danger.clearHistory"),
          stop: t("actions.stop"),
          pause: t("actions.pause"),
          start: t("actions.start"),
          restart: t("actions.restart"),
          actions: t("actions.more"),
          dangerZone: t("danger.title"),
          wsConnected: t("ws.connected"),
          wsConnecting: t("ws.connecting"),
          wsDisconnected: t("ws.disconnected"),
          noPermissionStart: t("actions.noPermissionStart"),
          noPermissionUpdate: t("actions.noPermissionUpdate"),
        }}
      />

      {/* An automatic pause and a manual one look identical without this. */}
      {campaign.statusReason ? (
        <div className="flex items-start gap-2 rounded-[--radius] border border-warning bg-warning px-3 py-2 text-warning-foreground">
          <Warning className="mt-0.5 h-4 w-4 shrink-0" weight="fill" />
          <p className="text-sm">{campaign.statusReason}</p>
        </div>
      ) : null}

      {!campaign.instanceSessionLive ? (
        <div className="flex items-start gap-2 rounded-[--radius] border border-destructive bg-destructive px-3 py-2 text-destructive-foreground">
          <Warning className="mt-0.5 h-4 w-4 shrink-0" weight="fill" />
          <p className="text-sm">{t("detail.numberOffline")}</p>
        </div>
      ) : null}

      {/* Campaign info + metrics, in the same shape the Cloud API campaign
          uses: an identity card carrying the channel plate and the settings an
          operator checks before starting, then the wall of numbers. */}
      <div className="grid gap-4">
        <div
          className="max-h-max rounded-[--radius] border border-border bg-card p-6"
          style={{ boxShadow: softSurfaceShadow }}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-lg",
                  channelPlate("unofficial_whatsapp"),
                )}
              >
                <WhatsappLogo className="h-6 w-6" weight="fill" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold tracking-[0.01em] text-foreground">
                  {campaign.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {t("detail.number")}: {campaign.instanceLabel || "—"}
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span>
                    {t("detail.messageKind")}: {t(`messageKind.${campaign.message.kind}`)}
                  </span>
                  {campaign.message.bodies.length > 1 ? (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span>
                        {t("detail.variants", { count: campaign.message.bodies.length })}
                      </span>
                    </>
                  ) : null}
                  {campaign.enableAgentResponses ? (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-healthy-ink">{t("detail.agentOn")}</span>
                    </>
                  ) : null}
                  {campaign.enableWorkflow ? (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-healthy-ink">{t("detail.workflowOn")}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {/* The pacing an operator has to be able to read at a glance: it is
                what decides how long this campaign will take, and on this
                channel it is also the ban control. */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span>
                {t("detail.pacing", {
                  min: (campaign.sendDelayMinMs / 1000).toFixed(1),
                  max: (campaign.sendDelayMaxMs / 1000).toFixed(1),
                })}
              </span>
              {campaign.dailyCap > 0 ? (
                <span>{t("detail.dailyCap", { cap: campaign.dailyCap })}</span>
              ) : null}
            </div>
          </div>

          <CampaignMetricsTiles
            metrics={campaign.metrics}
            channel="unofficial_whatsapp"
            glyph={<WhatsappLogo weight="fill" className="h-5 w-5" />}
            labels={{
              total: t("table.total"),
              pending: t("status.pending"),
              sent: t("status.sent"),
              delivered: t("status.delivered"),
              read: t("status.read"),
              failed: t("status.failed"),
              avoidingSpam: t("table.avoidingSpam"),
              notOnWhatsapp: t("table.notOnWhatsapp"),
            }}
          />
        </div>
      </div>


      {/* Filters sit above the contacts card, not inside its toolbar: they
          narrow what the card shows, and the official campaign puts them in the
          same place. */}
      <EntryFiltersBar
        campaignType="unofficial_whatsapp"
        values={entryFilters}
        onChange={(next) => {
          setEntryFilters(next);
          setEntriesPage(1);
        }}
        stages={[]}
        canFilterByStage={false}
        statusOptions={UNOFFICIAL_SEND_STATUSES.map((status) => ({
          value: status.value,
          label: t(status.labelKey),
        }))}
        translations={{
          searchPlaceholder: t("entries.searchPlaceholder"),
          statusLabel: t("entries.status"),
          statusAll: t("filter.all"),
          tagLabel: t("entries.stage"),
          tagAll: t("filter.all"),
          tagNone: t("entries.noStage"),
          clearFilters: t("entries.clearFilters"),
          activeFilters: t("entries.activeFilters"),
          errorCodePlaceholder: t("entries.errorCode"),
        }}
      />

      <div
        className="rounded-[--radius] border border-border bg-card p-8"
        style={{ boxShadow: softSurfaceShadow }}
      >
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-healthy text-healthy-foreground">
              <UserCircle weight="bold" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold tracking-[0.01em] text-foreground">
                {t("entries.title")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("entries.description")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 rounded-[--radius] bg-healthy px-3 py-1.5 text-xs font-semibold text-healthy-foreground">
              <CheckCircle weight="fill" className="h-4 w-4" />
              {entriesMeta.totalItems} {t("entries.records")}
            </span>
            <Button
              variant="outline-subtle"
              title={exporting ? t("entries.exporting") : t("entries.export")}
              icon={<DownloadSimple weight="bold" className="h-4 w-4" />}
              iconVisible
              iconSide="left"
              onClick={handleExport}
              disabled={exporting}
            />
          </div>
        </div>

        {entriesLoading ? (
          <div className="flex min-h-[400px] items-center justify-center rounded-[--radius] border border-border bg-muted px-6 py-8 text-sm text-muted-foreground">
            <div className="flex flex-col items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border border-foreground/20 border-t-healthy" />
              <span>{t("entries.loading")}</span>
            </div>
          </div>
        ) : (
          <div className="min-h-[400px]">
            <div className="grid gap-4 lg:grid-cols-2">
              {entries.map((entry) => {
                const statusCode = entry.status ?? "PENDING";
                const badgeClass =
                  entryStatusStyles[statusCode] ?? "bg-muted text-muted-foreground";
                const statusLabel = t(
                  `status.${entryStatusKeys[statusCode] ?? "pending"}`,
                );

                return (
                  <div
                    key={entry.id}
                    className="group relative rounded-[--radius] border border-border bg-card p-5 transition-all duration-200 hover:border-foreground/20 hover:shadow-md"
                  >
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {/* Only once the campaign has actually reached this
                            person is there a transcript to open. */}
                        {entry.conversationId ? (
                          <EntryConversationDialog
                            entryId={entry.conversationId}
                            entryType="unofficial_whatsapp"
                            phoneNumber={entry.number}
                            contactName={entry.name}
                            trigger={
                              <button
                                type="button"
                                className="inline-flex h-10 w-10 items-center justify-center rounded-[--radius] bg-healthy text-healthy-foreground transition-all hover:scale-105"
                                title={t("entries.open")}
                              >
                                <ChatCircle weight="fill" className="h-5 w-5" />
                              </button>
                            }
                          />
                        ) : (
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-[--radius] bg-muted text-muted-foreground">
                            <ChatCircle weight="fill" className="h-5 w-5" />
                          </span>
                        )}
                        <div>
                          <p className="text-lg font-semibold tracking-wide text-foreground">
                            {entry.number}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2">
                            {entry.name ? (
                              <span className="text-sm font-medium text-muted-foreground">
                                {entry.name}
                              </span>
                            ) : (
                              <span className="text-sm italic text-muted-foreground">
                                {t("entries.noName")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-2xs font-semibold",
                          badgeClass,
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {statusLabel}
                      </span>
                    </div>

                    {statusCode === "FAILED" && entry.errorMessage ? (
                      <div className="mb-3 rounded-lg border border-border bg-muted px-3 py-2">
                        {entry.errorCode ? (
                          <p className="text-2xs font-semibold text-destructive-ink">
                            {t("entries.errorCode")}: {entry.errorCode}
                          </p>
                        ) : null}
                        <p className="mt-0.5 line-clamp-2 text-2xs text-destructive-ink">
                          {entry.errorMessage}
                        </p>
                      </div>
                    ) : null}

                    {/* Which body this person received. Only worth showing when
                        the campaign actually rotates variants. */}
                    {campaign.message.bodies.length > 1 ? (
                      <div className="mb-3">
                        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-2xs text-foreground">
                          <span className="font-semibold text-healthy-ink">
                            {t("entries.variant")}
                          </span>
                          <span>{entry.variantIndex + 1}</span>
                        </span>
                      </div>
                    ) : null}

                    {entry.variables && entry.variables.length > 0 ? (
                      <details className="group/vars mb-3">
                        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
                          <ListDashes weight="bold" className="h-3.5 w-3.5" />
                          {t("entries.variables")}
                          <CaretDown
                            weight="bold"
                            className="h-3 w-3 transition-transform duration-200 group-open/vars:rotate-180"
                          />
                        </summary>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {entry.variables.map((variable, vi) => (
                            <span
                              key={vi}
                              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-2xs text-foreground"
                            >
                              <span className="font-semibold text-healthy-ink">
                                {`{{${vi + 1}}}`}
                              </span>
                              <span>{variable}</span>
                            </span>
                          ))}
                        </div>
                      </details>
                    ) : null}

                    <div className="flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                      <CalendarCheck weight="fill" className="h-3.5 w-3.5" />
                      <span suppressHydrationWarning>
                        {formatDate(entry.sentAt ?? entry.updatedAt)}
                      </span>
                    </div>
                  </div>
                );
              })}

              {!entries.length ? (
                <div className="col-span-2 rounded-[--radius] border border-border bg-muted px-6 py-8 text-center text-sm text-muted-foreground">
                  {t("entries.emptyDescription")}
                </div>
              ) : null}
            </div>

            {entriesMeta.totalPages > 1 ? (
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  title={t("entries.previous")}
                  disabled={entriesPage <= 1 || entriesLoading}
                  onClick={() => setEntriesPage((p) => p - 1)}
                />
                <span className="text-sm text-muted-foreground">
                  {entriesPage} / {entriesMeta.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  title={t("entries.next")}
                  disabled={entriesPage >= entriesMeta.totalPages || entriesLoading}
                  onClick={() => setEntriesPage((p) => p + 1)}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* containerKind="campaign" is what makes this the CAMPAIGN's inbox
          rather than the whole number's: on this channel a conversation belongs
          to a number forever, while a campaign is one run across many. */}
      <CrmDialog
        isOpen={showCrmDialog}
        onClose={() => setShowCrmDialog(false)}
        campaignId={campaign.id}
        campaignType="unofficial_whatsapp"
        containerKind="campaign"
        translations={{
          dialogTitle: t("crm.dialogTitle"),
          dialogDescription: t("crm.dialogDescription"),
          inbox: {
            title: tCrm("inbox.title"),
            searchPlaceholder: tCrm("inbox.searchPlaceholder"),
            noConversations: tCrm("inbox.noConversations"),
            connecting: tCrm("inbox.connecting"),
            disconnected: tCrm("inbox.disconnected"),
            connected: tCrm("inbox.connected"),
            loadingMore: tCrm("inbox.loadingMore"),
          },
          conversation: {
            noConversationSelected: tCrm("conversation.noConversationSelected"),
            noConversationDescription: tCrm("conversation.noConversationDescription"),
            loadingMore: tCrm("conversation.loadingMore"),
            windowClosed: tCrm("conversation.windowClosed"),
            windowClosedDescription: tCrm("conversation.windowClosedDescription"),
            noPermissionStageAssign: tCrm("conversation.noPermissionStageAssign"),
          },
          input: {
            placeholder: tCrm("input.placeholder"),
            windowClosed: tCrm("input.windowClosed"),
            windowClosedDescription: tCrm("input.windowClosedDescription"),
            windowClosedNoClock: tCrm("input.windowClosedNoClock"),
            sendButton: tCrm("input.sendButton"),
            attachFile: tCrm("input.attachFile"),
            recording: tCrm("input.recording"),
            uploading: tCrm("input.uploading"),
            windowExpires: tCrm("input.windowExpires"),
            noPermissionSend: tCrm("input.noPermissionSend"),
          },
        }}
      />

      <CampaignConfirmModal
        open={resetCode !== undefined}
        title={t("danger.resetTitle")}
        description={t("danger.resetDescription")}
        code={resetCode}
        codeLabel={t("danger.code")}
        confirmLabel={t("danger.reset")}
        cancelLabel={t("actions.cancel")}
        mismatchLabel={t("danger.codeMismatch")}
        pending={pending}
        onClose={() => setResetCode(undefined)}
        onConfirm={(code) =>
          startTransition(async () => {
            const result = await confirmResetUnofficialCampaignAction(campaign.id, code);
            setResetCode(undefined);
            if (result.error) {
              toast({ title: t("actions.failed"), description: result.error, variant: "destructive" });
              return;
            }
            toast({ title: t("danger.resetDone") });
            await refresh();
            await fetchEntries();
          })
        }
      />

      <CampaignConfirmModal
        open={clearCode !== undefined}
        title={t("danger.clearTitle")}
        description={t("danger.clearDescription")}
        code={clearCode}
        codeLabel={t("danger.code")}
        confirmLabel={t("danger.clearHistory")}
        cancelLabel={t("actions.cancel")}
        mismatchLabel={t("danger.codeMismatch")}
        pending={pending}
        onClose={() => setClearCode(undefined)}
        onConfirm={(code) =>
          startTransition(async () => {
            const result = await confirmClearHistoryUnofficialCampaignAction(campaign.id, code);
            setClearCode(undefined);
            if (result.error) {
              toast({ title: t("actions.failed"), description: result.error, variant: "destructive" });
              return;
            }
            toast({ title: t("danger.clearDone") });
            await refresh();
          })
        }
      />

    </main>
  );
}
