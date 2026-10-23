"use client";

import { CheckCircle } from "@/components/icons";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import Button from "@/components/elevated-design/button";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { Notice } from "@/components/ui/notice";
import { CampaignLiveOverview } from "@/components/campaigns/detail/CampaignLiveOverview";
import { CampaignTimelinePanel } from "@/components/campaigns/detail/CampaignTimelinePanel";
import { CampaignContactsTable, type CampaignContactRow } from "@/components/campaigns/detail/CampaignContactsTable";
import { useCampaignProgress, useLiveFollowUp } from "@/hooks/use-campaign-live";
import { EMPTY_CAMPAIGN_METRICS } from "@/lib/campaigns/metrics";
import { UnofficialCampaignSettingsPanel } from "./UnofficialCampaignSettingsPanel";
import { CampaignConfirmModal } from "@/components/campaigns/CampaignConfirmModal";
import CrmDialog from "@/components/crm/CrmDialog";
import CampaignHeader from "@/components/dashboard/CampaignHeader";
import { SelectionSendNote, useSelectionSendRefusalText } from "@/components/campaigns/SelectionSendNote";
import { selectionSendControls } from "@/lib/campaigns/selection-send";
import EntryFiltersBar, {
  type EntryFilterValues,
} from "@/components/dashboard/EntryFiltersBar";
import type {
  UnofficialWhatsAppCampaign,
  UnofficialWhatsAppCampaignEntry,
} from "@/lib/unofficial-whatsapp-campaigns/types";
import { showsReady } from "@/lib/unofficial-whatsapp-campaigns/ready";
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
import { useReportJob } from "@/hooks/use-report-job";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";
import { ChoiceClicksCard, type ChoiceOptionLabel } from "@/components/choice-stats/ChoiceClicksCard";
import { usePromptChoiceStats } from "@/components/choice-stats/use-prompt-choice-stats";

function menuChoices(campaign: UnofficialWhatsAppCampaign): ChoiceOptionLabel[] {
  if (campaign.message.kind !== "menu") return [];
  return (campaign.message.options ?? []).map((option) => ({ optionId: option.id, label: option.title }));
}

const ENTRIES_PAGE_SIZE = 25;

export default function UnofficialCampaignDetail({
  campaign: initial,
}: {
  campaign: UnofficialWhatsAppCampaign;
}) {
  const t = useTranslations("unofficialWhatsappCampaigns");
  const tDetail = useTranslations("campaignDetail");
  const tShared = useTranslations("campaignWizard");
  const refusalText = useSelectionSendRefusalText();
  const tCrm = useTranslations("crm");
  const tSidebar = useTranslations("sidebar");
  const { can } = useWorkspace();
  const [pending, startTransition] = useTransition();

  const [campaign, setCampaign] = useState(initial);
  const choices = useMemo(() => menuChoices(campaign), [campaign]);
  const choiceClicks = usePromptChoiceStats(choices.length > 0 ? { kind: "unofficial_campaign", id: campaign.id } : null);
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

  const fetchEntries = useCallback(async (showLoading = true) => {
    if (showLoading) setEntriesLoading(true);
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
      if (showLoading) setEntriesLoading(false);
    }
  }, [campaign.id, entriesPage, entryFilters.status, entryFilters.search]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const progress = useCampaignProgress("unofficial_whatsapp", campaign.id);
  const followSample = useCallback(() => {
    void fetchEntries(false);
  }, [fetchEntries]);
  useLiveFollowUp({
    sampledAt: progress.data?.sampledAt,
    liveStatus: progress.data?.status,
    campaignStatus: campaign.status,
    onSample: followSample,
    onStatusChange: refresh,
  });
  const liveStatus = progress.data?.status ?? campaign.status;
  const metrics = progress.data?.metrics ?? campaign.metrics ?? EMPTY_CAMPAIGN_METRICS;

  const act = (
    action: () => Promise<{ error?: string; code?: string }>,
    successKey: string,
  ) =>
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(t("actions.failed"), { description: refusalText(result.code, result.error) });
        return;
      }
      toast(t(successKey));
      await progress.refetch();
      await refresh();
      await fetchEntries();
    });

  const [showCrmDialog, setShowCrmDialog] = useState(false);
  const { running: exporting, track } = useReportJob();

  const handleExport = async () => {
    const queued = await exportUnofficialCampaignEntriesAction(campaign.id, {
      status: entryFilters.status || undefined,
      search: entryFilters.search || undefined,
    });

    const failed = (reason: string) => {
      toast.error(t("actions.failed"), { description: t(`entries.exportError.${reason}`) });
    };

    if (queued.error || !queued.job) {
      failed(queued.error ?? "generic");
      return;
    }

    const settled = await track(queued.job);
    if (settled.status === "error") {
      failed("generic");
      return;
    }
    if (settled.status === "failed") {
      failed(
        settled.job.failureCode === "empty_result"
          ? "noEntries"
          : settled.job.failureCode === "too_many_rows"
            ? "tooLarge"
            : "generic",
      );
    }
  };

  const canUpdate = can("unofficial_whatsapp_campaigns", "update");
  const selectionSend = selectionSendControls(campaign.source, campaign.status);
  const canRunStart = can("unofficial_whatsapp_campaigns", "start");
  const canRunStop = can("unofficial_whatsapp_campaigns", "stop");
  const sendsToGroups = campaign.audience === "groups";
  const senderPerGroup = sendsToGroups && !campaign.instanceId;
  const rows: CampaignContactRow[] = useMemo(
    () =>
      entries.map((entry) => ({
        id: entry.id,
        conversationId: entry.conversationId ?? null,
        number: entry.number,
        name: entry.name,
        group: entry.isGroup ? { jid: entry.jid } : undefined,
        status: entry.status,
        variables: entry.variables,
        metadata: entry.metadata,
        updatedAt: entry.sentAt ?? entry.updatedAt,
        marks: entry.isGroup ? <StatusChip tone="outline" label={t("entries.groupMark")} /> : undefined,
        note: [
          entry.senderInstanceId ? t("entries.sentBy", { number: entry.senderLabel || entry.senderInstanceId }) : null,
          campaign.message.bodies.length > 1 ? `${t("entries.variant")} ${entry.variantIndex + 1}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      })),
    [entries, campaign.message.bodies.length, t],
  );
  const entryById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const describeFailure = useCallback(
    (row: CampaignContactRow) => {
      const entry = entryById.get(row.id);
      if (!entry || entry.status !== "FAILED" || !entry.errorMessage) return null;
      return { description: entry.errorMessage, code: entry.errorCode ?? null };
    },
    [entryById],
  );

  return (
    <main className="w-full space-y-4">
      <CampaignHeader
        name={campaign.name}
        status={showsReady(campaign, liveStatus) ? "READY" : liveStatus}
        statusLabel={showsReady(campaign, liveStatus) ? tShared("status.ready") : tDetail(`status.${liveStatus}`)}
        campaignType="unofficial_whatsapp"
        backLink="/dashboard/unofficial-whatsapp-campaigns"
        editLink={`/dashboard/unofficial-whatsapp-campaigns/${campaign.id}/edit`}
        isPending={pending}
        canStart={selectionSend.start && canStart(campaign.status) && campaign.instanceSessionLive}
        canPause={canPause(campaign.status)}
        canStop={canStop(campaign.status)}
        canReset={selectionSend.reset && campaign.status !== "RUNNING"}
        hasPermissionStart={canRunStart}
        hasPermissionStop={canRunStop}
        extraActions={
          canUpdate && !sendsToGroups
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
                        toast.error(t("actions.failed"), { description: result.error });
                        return;
                      }
                      toast(t("actions.validated"), {
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
              toast.error(t("actions.failed"), { description: result.error });
              return;
            }
            setResetCode(result.data?.resetCode);
          })
        }
        onClearHistory={() =>
          startTransition(async () => {
            const result = await prepareClearHistoryUnofficialCampaignAction(campaign.id);
            if (result.error) {
              toast.error(t("actions.failed"), { description: result.error });
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

      {selectionSend.fromLeads ? <SelectionSendNote /> : null}

      {campaign.statusReason ? <Notice tone="warning" title={campaign.statusReason} /> : null}

      {!campaign.instanceSessionLive && !senderPerGroup ? <Notice tone="fault" title={t("detail.numberOffline")} /> : null}

      <CampaignLiveOverview
        status={liveStatus}
        metrics={metrics}
        pace={progress.data?.pace}
        sampledAt={progress.data?.sampledAt}
        progressUnavailable={progress.isError && !progress.data}
        activeStatus={entryFilters.status}
        onFilterStatus={(next) => {
          setEntryFilters({ ...entryFilters, status: next });
          setEntriesPage(1);
        }}
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <CampaignTimelinePanel channel="unofficial_whatsapp" campaignId={campaign.id} className="lg:col-span-8" />
        <UnofficialCampaignSettingsPanel campaign={campaign} canEdit={canUpdate} className="lg:col-span-4" />
        {choices.length > 0 ? <ChoiceClicksCard read={choiceClicks} options={choices} scope="campaign" className="lg:col-span-12" /> : null}
      </div>

      <CampaignContactsTable
        entryType="unofficial_whatsapp"
        rows={rows}
        loading={entriesLoading}
        totalItems={entriesMeta.totalItems}
        page={entriesPage}
        totalPages={entriesMeta.totalPages}
        pageSize={ENTRIES_PAGE_SIZE}
        onPageChange={setEntriesPage}
        describeFailure={describeFailure}
        stages={[]}
        entryStages={{}}
        canManageStages={false}
        canReadStages={false}
        onAssignStage={async () => undefined}
        onRemoveStage={async () => undefined}
        exporting={exporting}
        onExport={handleExport}
        toolbar={
          <EntryFiltersBar
            bare
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
        }
      />

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
              toast.error(t("actions.failed"), { description: result.error });
              return;
            }
            toast(t("danger.resetDone"));
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
              toast.error(t("actions.failed"), { description: result.error });
              return;
            }
            toast(t("danger.clearDone"));
            await refresh();
          })
        }
      />

    </main>
  );
}
