"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { ArrowClockwise, Headset, PencilSimple, Plus, SpeakerHigh, Trash, UsersThree, XCircle } from "@/components/icons";
import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CallQueueSheet } from "@/components/call-queues/call-queue-sheet";
import { HoldMusicPicker } from "@/components/call-queues/hold-music-picker";
import { QueueMonitor } from "@/components/call-queues/queue-monitor";
import { useHoldMusicLibrary, type HoldMusicLibrary } from "@/components/call-queues/use-hold-music-library";
import {
  deleteCallQueueAction,
  getRoutingSettingsAction,
  listCallQueuesAction,
  saveRoutingSettingsAction,
} from "@/app/actions/call-routing";
import { useWorkspace } from "@/contexts/workspace-context";
import { useToast } from "@/hooks/use-toast";
import { fetchDepartments } from "@/lib/department/client";
import { DEFAULT_HOLD_PRESET, holdMusicKey, type CallQueue, type HoldMusicRef } from "@/lib/call-routing/types";
import { cn } from "@/lib/utils";

export default function CallQueuesPage() {
  const t = useTranslations("callQueues");
  const { can } = useWorkspace();
  const { toast } = useToast();
  const library = useHoldMusicLibrary();
  const [queues, setQueues] = useState<CallQueue[]>([]);
  const [departmentNames, setDepartmentNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CallQueue | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleting, setDeleting] = useState<CallQueue | null>(null);

  const canCreate = can("call_queues", "create");
  const canUpdate = can("call_queues", "update");
  const canDelete = can("call_queues", "delete");

  const load = useCallback(() => {
    void Promise.all([listCallQueuesAction(), fetchDepartments()]).then(([queueResult, departmentResult]) => {
      setError(queueResult.error ?? null);
      setQueues(queueResult.queues);
      setDepartmentNames(Object.fromEntries(departmentResult.departments.map((department) => [department.id, department.name])));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = useCallback((queue: CallQueue) => {
    setEditing(queue);
    setSheetOpen(true);
  }, []);

  const confirmDelete = async () => {
    if (!deleting) return;
    const result = await deleteCallQueueAction(deleting.id);
    if (result.error) {
      toast({ title: t("delete.failed"), description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: t("delete.done"), description: deleting.name });
    setDeleting(null);
    load();
  };

  const musicName = useCallback(
    (ref: HoldMusicRef) => {
      if (ref.mediaId) return library.audios.find((media) => media.id === ref.mediaId)?.description || t("holdMusic.uploaded");
      const presetId = ref.presetId || DEFAULT_HOLD_PRESET;
      return t.has(`holdMusic.presets.${presetId}`) ? t(`holdMusic.presets.${presetId}`) : presetId;
    },
    [library.audios, t],
  );

  const columns = useMemo<DashboardTableColumn<CallQueue>[]>(
    () => [
      {
        key: "queue",
        header: t("table.queue"),
        render: (row) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{row.name}</span>
            <span className="text-xs text-muted-foreground">{t(`form.strategies.${row.strategy}.label`)}</span>
          </div>
        ),
      },
      {
        key: "members",
        header: t("table.members"),
        render: (row) => (
          <span className="text-sm text-muted-foreground">
            {row.departmentId
              ? t("table.department", { name: departmentNames[row.departmentId] ?? "…" })
              : t("table.people", { count: row.memberUserIds.length })}
          </span>
        ),
      },
      {
        key: "timing",
        header: t("table.timing"),
        render: (row) => (
          <span className="readout text-xs text-muted-foreground">
            {t("table.timingValue", { ring: row.ringSeconds, wait: Math.round(row.maxWaitSeconds / 60), wrapUp: row.wrapUpSeconds })}
          </span>
        ),
      },
      {
        key: "music",
        header: t("table.music"),
        render: (row) => <span className="text-sm text-muted-foreground">{musicName(row.holdMusic)}</span>,
      },
    ],
    [departmentNames, musicName, t],
  );

  const renderRowActions = useCallback(
    (row: CallQueue) => (
      <div className="flex items-center gap-1">
        {canUpdate ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openEdit(row);
            }}
            title={t("actions.edit")}
            aria-label={t("actions.edit")}
            className="inline-flex items-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PencilSimple className="h-4 w-4" />
          </button>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setDeleting(row);
            }}
            title={t("actions.delete")}
            aria-label={t("actions.delete")}
            className="inline-flex items-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive-ink"
          >
            <Trash className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    ),
    [canDelete, canUpdate, openEdit, t],
  );

  const createButton = canCreate ? (
    <Button variant="primary" title={t("page.create")} icon={<Plus weight="bold" className="h-4 w-4" />} iconVisible iconSide="left" onClick={openCreate} />
  ) : undefined;

  const departmentQueues = queues.filter((queue) => queue.departmentId).length;

  return (
    <div className="w-full space-y-6">
      <DashboardPageHeader badge={t("page.title")} description={t("page.description")} icon={<Headset className="h-6 w-6" />} colorClass="text-info-ink" />

      <QueueMonitor />

      <DashboardTable<CallQueue>
        data={queues}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        onRowClick={canUpdate ? openEdit : undefined}
        renderRowActions={renderRowActions}
        stats={[
          { label: t("stats.total"), value: loading ? "…" : queues.length, icon: <Headset className="h-4 w-4 text-info-ink" /> },
          { label: t("stats.byDepartment"), value: loading ? "…" : departmentQueues, icon: <UsersThree className="h-4 w-4 text-info-ink" /> },
        ]}
        headerRight={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              title=""
              aria-label={t("page.refresh")}
              icon={<ArrowClockwise weight="bold" className={cn("h-4 w-4", loading && "animate-spin")} />}
              iconVisible
              iconSide="left"
              onClick={load}
            />
            {createButton}
          </div>
        }
        emptyState={
          error
            ? {
                icon: <XCircle className="h-7 w-7 text-destructive-ink" weight="fill" />,
                title: t("page.errorTitle"),
                description: error,
                action: <Button variant="secondary" title={t("page.retry")} onClick={load} />,
              }
            : {
                icon: <Headset className="h-7 w-7 text-muted-foreground" />,
                title: t("page.emptyTitle"),
                description: t("page.emptyDescription"),
                action: createButton,
              }
        }
      />

      <WorkspaceHoldMusic library={library} canUpdate={canUpdate} />

      <CallQueueSheet open={sheetOpen} onOpenChange={setSheetOpen} queue={editing} library={library} onSaved={load} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("delete.title")}
        description={t("delete.body", { name: deleting?.name ?? "" })}
        confirmLabel={t("delete.confirm")}
        cancelLabel={t("delete.cancel")}
        tone="danger"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function WorkspaceHoldMusic({ library, canUpdate }: { library: HoldMusicLibrary; canUpdate: boolean }) {
  const t = useTranslations("callQueues.workspaceMusic");
  const { toast } = useToast();
  const [saved, setSaved] = useState<HoldMusicRef | null>(null);
  const [choice, setChoice] = useState<HoldMusicRef | null>(null);
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    void getRoutingSettingsAction().then((result) => {
      const ref = result.settings?.holdMusic ?? { presetId: DEFAULT_HOLD_PRESET };
      setSaved(ref);
      setChoice(ref);
    });
  }, []);

  if (!saved || !choice) return null;
  const changed = holdMusicKey(saved) !== holdMusicKey(choice);

  const save = () =>
    startSaving(async () => {
      const result = await saveRoutingSettingsAction({ holdMusic: choice });
      if (result.error || !result.settings) {
        toast({ title: t("saveFailed"), description: result.error, variant: "destructive" });
        return;
      }
      setSaved(result.settings.holdMusic);
      toast({ title: t("saved") });
    });

  return (
    <section aria-labelledby="workspace-hold-music" className="rounded-[--radius] border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius] bg-muted text-primary-ink">
          <SpeakerHigh className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="workspace-hold-music" className="text-sm font-semibold text-foreground">
            {t("title")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("description")}</p>
        </div>
      </div>
      <div className={cn("mt-4", !canUpdate && "pointer-events-none opacity-60")} aria-disabled={!canUpdate}>
        <HoldMusicPicker value={choice} onChange={setChoice} library={library} />
      </div>
      {canUpdate ? (
        <div className="mt-4 flex justify-end">
          <Button variant="primary" title={saving ? t("saving") : t("save")} onClick={save} disabled={!changed || saving} />
        </div>
      ) : null}
    </section>
  );
}
