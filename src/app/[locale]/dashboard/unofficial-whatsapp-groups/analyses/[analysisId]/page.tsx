"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, usePathname, useRouter as useNextRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { deleteGroupAnalysisAction, getGroupAnalysisAction, updateGroupAnalysisAction } from "@/app/actions/unofficial-whatsapp-groups";
import { Skeleton } from "@/components/audience/shared";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import { Brain, CircleNotch, Pause, PencilSimple, Play, Trash, WarningCircle } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import { AnalysisConfigChapter, AnalysisContextStrip } from "@/components/unofficial-whatsapp-groups/analyses/analysis-config";
import { AnalysisFormSheet } from "@/components/unofficial-whatsapp-groups/analyses/analysis-form-sheet";
import { AnalysisPeriodChapter } from "@/components/unofficial-whatsapp-groups/analyses/analysis-overview";
import { latestFailure } from "@/components/unofficial-whatsapp-groups/analyses/analysis-series";
import { RunHistoryChapter } from "@/components/unofficial-whatsapp-groups/analyses/run-history";
import { TrackedFieldsChapter } from "@/components/unofficial-whatsapp-groups/analyses/tracked-fields-panel";
import { AnalysisStatusMark, TriggerSummary } from "@/components/unofficial-whatsapp-groups/kit/figures";
import { GroupIdentity } from "@/components/unofficial-whatsapp-groups/kit/identity";
import { KpiBand } from "@/components/unofficial-whatsapp-groups/kit/kpi-band";
import { PausedAnalysisNotice } from "@/components/unofficial-whatsapp-groups/kit/notices";
import { DEFAULT_ANALYSIS_WINDOW, groupsRoutes, parseAnalysisWindow, type AnalysisWindow } from "@/components/unofficial-whatsapp-groups/kit/routes";
import { useGroupsFormat } from "@/components/unofficial-whatsapp-groups/kit/use-groups-format";
import { useWorkspace } from "@/contexts/workspace-context";
import { useRouter } from "@/i18n/routing";
import type { AnalysisDetail, AnalysisRun, GroupAnalysis } from "@/lib/unofficial-whatsapp-groups/types";

interface LoadedDetail {
  key: string;
  analysisId: string;
  days: AnalysisWindow;
  detail: AnalysisDetail | null;
  error: string | null;
  notFound: boolean;
}

const NOT_FOUND_STATUSES = new Set([403, 404]);

export default function GroupAnalysisDetailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <AnalysisDetailView />
    </Suspense>
  );
}

function AnalysisDetailView() {
  const t = useTranslations("unofficialGroups.analyses");
  const td = useTranslations("unofficialGroups.analyses.detailPage");
  const tl = useTranslations("unofficialGroups.analyses.listPage");
  const params = useParams<{ analysisId: string }>();
  const analysisId = params?.analysisId ?? "";
  const router = useRouter();
  const navigation = useNextRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const days = parseAnalysisWindow(searchParams.get("days"));
  const focusRunId = searchParams.get("run")?.trim() || undefined;
  const { can } = useWorkspace();
  const canConfigure = can("unofficial_whatsapp_groups", "configure");
  const canDelete = can("unofficial_whatsapp_groups", "delete");

  const [loaded, setLoaded] = useState<LoadedDetail | null>(null);
  const [version, setVersion] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [lastFailure, setLastFailure] = useState<string | undefined>(undefined);
  const loadedRef = useRef<LoadedDetail | null>(null);
  const requestKey = `${analysisId}:${days}:${version}`;

  const setDays = useCallback(
    (next: AnalysisWindow) => {
      const query = new URLSearchParams(searchParams.toString());
      query.delete("run");
      if (next === DEFAULT_ANALYSIS_WINDOW) query.delete("days");
      else query.set("days", String(next));
      const text = query.toString();
      navigation.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
    },
    [navigation, pathname, searchParams],
  );
  const setDaysRef = useRef(setDays);

  useEffect(() => {
    setDaysRef.current = setDays;
  }, [setDays]);

  useEffect(() => {
    if (!analysisId) return;
    let cancelled = false;
    void getGroupAnalysisAction(analysisId, days).then((result) => {
      if (cancelled) return;
      const previous = loadedRef.current;
      let next: LoadedDetail;
      if (result.error && previous?.detail && previous.analysisId === analysisId && !NOT_FOUND_STATUSES.has(result.status ?? 0)) {
        toast.error(td("reloadFailed"), { description: result.error });
        next = { ...previous, key: requestKey };
        if (previous.days !== days) setDaysRef.current(previous.days);
      } else {
        next = {
          key: requestKey,
          analysisId,
          days,
          detail: result.data ?? null,
          error: result.error ?? null,
          notFound: Boolean(result.error) && NOT_FOUND_STATUSES.has(result.status ?? 0),
        };
      }
      loadedRef.current = next;
      setLoaded(next);
    });
    return () => {
      cancelled = true;
    };
  }, [analysisId, days, requestKey, td]);

  const refresh = useCallback(() => setVersion((current) => current + 1), []);
  const onFirstPage = useCallback((runs: AnalysisRun[]) => setLastFailure(latestFailure(runs)), []);

  const toggleStatus = async (analysis: GroupAnalysis) => {
    const status = analysis.status === "active" ? "paused" : "active";
    setToggling(true);
    const result = await updateGroupAnalysisAction(analysis.id, { status });
    setToggling(false);
    if (result.error) {
      toast.error(t("toggleFailed"), { description: result.error });
      return;
    }
    toast(status === "active" ? t("resumed") : t("paused"), { description: analysis.name });
    refresh();
  };

  const back = { onClick: () => router.push(groupsRoutes.analyses()), label: t("detail.back") };
  const firstLoad = !loaded || loaded.analysisId !== analysisId;
  const detail = firstLoad ? null : loaded.detail;

  if (firstLoad) {
    return (
      <div className="w-full space-y-4">
        <DashboardPageHeader icon={<Brain className="h-6 w-6" />} badge={t("detail.badge")} description={t("detail.loading")} back={back} />
        <Skeleton className="h-11" />
        <KpiBand label="" cells={[]} columns={6} loading />
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-12">
          <Skeleton className="h-[268px] xl:col-span-8" />
          <Skeleton className="h-[268px] xl:col-span-4" />
        </div>
      </div>
    );
  }

  if (!detail) {
    const notFound = loaded.notFound;
    return (
      <div className="w-full space-y-4">
        <DashboardPageHeader
          icon={<Brain className="h-6 w-6" />}
          badge={t("detail.badge")}
          description={notFound ? t("detail.notFoundDescription") : td("faultDescription")}
          back={back}
        />
        <Notice tone={notFound ? "warning" : "fault"} title={notFound ? t("detail.notFound") : td("faultTitle")} icon={<WarningCircle weight="fill" />}>
          {notFound ? <p className="text-muted-foreground">{t("detail.notFoundHint")}</p> : null}
          {loaded.error ? <p className="text-muted-foreground">{loaded.error}</p> : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="secondary" size="sm" title={t("retry")} onClick={refresh} />
            <Button variant="ghost" size="sm" title={t("detail.back")} onClick={back.onClick} />
          </div>
        </Notice>
      </div>
    );
  }

  return (
    <AnalysisDetailBody
      detail={detail}
      days={days}
      refreshing={loaded.days !== days}
      version={version}
      focusRunId={focusRunId}
      lastFailure={lastFailure}
      back={back}
      canConfigure={canConfigure}
      canDelete={canDelete}
      toggling={toggling}
      onToggle={() => void toggleStatus(detail.analysis)}
      onDays={setDays}
      onFirstPage={onFirstPage}
      onEdit={() => setEditOpen(true)}
      onDelete={() => setDeleteOpen(true)}
    >
      {canConfigure ? (
        <AnalysisFormSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          analysis={detail.analysis}
          group={detail.group}
          timezone={detail.timezone}
          onSaved={() => refresh()}
        />
      ) : null}
      {canDelete ? (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          tone="danger"
          title={tl("deleteTitle")}
          description={tl("deleteBody")}
          confirmLabel={t("detail.delete")}
          onConfirm={async () => {
            const result = await deleteGroupAnalysisAction(detail.analysis.id);
            if (result.error) {
              toast.error(t("detail.deleteFailed"), { description: result.error });
              return false;
            }
            toast(t("detail.deleted"), { description: detail.analysis.name });
            router.push(groupsRoutes.analyses());
            return true;
          }}
        />
      ) : null}
    </AnalysisDetailBody>
  );
}

function AnalysisDetailBody({
  detail,
  days,
  refreshing,
  version,
  focusRunId,
  lastFailure,
  back,
  canConfigure,
  canDelete,
  toggling,
  onToggle,
  onDays,
  onFirstPage,
  onEdit,
  onDelete,
  children,
}: {
  detail: AnalysisDetail;
  days: AnalysisWindow;
  refreshing: boolean;
  version: number;
  focusRunId?: string;
  lastFailure?: string;
  back: { onClick: () => void; label: string };
  canConfigure: boolean;
  canDelete: boolean;
  toggling: boolean;
  onToggle: () => void;
  onDays: (days: AnalysisWindow) => void;
  onFirstPage: (runs: AnalysisRun[]) => void;
  onEdit: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("unofficialGroups.analyses");
  const td = useTranslations("unofficialGroups.analyses.detailPage");
  const fmt = useGroupsFormat(detail.timezone);
  const { analysis, group, timezone } = detail;
  const active = analysis.status === "active";

  return (
    <div className="w-full space-y-6">
      <div className="space-y-3">
        <DashboardPageHeader
          icon={<Brain className="h-6 w-6" />}
          badge={t("detail.badge")}
          title={analysis.name}
          description={td("description", { created: fmt.date(analysis.createdAt), updated: fmt.dateTime(analysis.updatedAt) })}
          back={back}
          meta={
            <>
              <AnalysisStatusMark analysis={analysis} />
              <span className="inline-flex max-w-[18rem] items-center rounded-[--radius] border border-border bg-card px-2 py-0.5">
                <GroupIdentity group={group} size="sm" sub="none" href={groupsRoutes.group(group.id, { tab: "analysis" })} />
              </span>
              <span className="inline-flex items-center rounded-[--radius] border border-border bg-card px-2 py-0.5 text-xs text-foreground">
                <TriggerSummary analysis={analysis} timezone={timezone} />
              </span>
            </>
          }
          actions={
            canConfigure || canDelete ? (
              <>
                {canConfigure ? (
                  <Button
                    variant="outline"
                    size="sm"
                    title={t("detail.edit")}
                    icon={<PencilSimple className="h-4 w-4" weight="bold" />}
                    iconVisible
                    iconSide="left"
                    onClick={onEdit}
                  />
                ) : null}
                {canConfigure ? (
                  <Button
                    variant="outline"
                    size="sm"
                    title={active ? t("pause") : t("resume")}
                    icon={
                      toggling ? (
                        <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
                      ) : active ? (
                        <Pause className="h-4 w-4" weight="bold" />
                      ) : (
                        <Play className="h-4 w-4" weight="bold" />
                      )
                    }
                    iconVisible
                    iconSide="left"
                    disabled={toggling}
                    onClick={onToggle}
                  />
                ) : null}
                {canDelete ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    title={t("detail.delete")}
                    icon={<Trash className="h-4 w-4" weight="bold" />}
                    iconVisible
                    iconSide="left"
                    onClick={onDelete}
                  />
                ) : null}
              </>
            ) : undefined
          }
        />
        <PausedAnalysisNotice analysis={analysis} lastFailure={lastFailure} onResume={canConfigure && !active ? onToggle : undefined} busy={toggling} />
        <AnalysisContextStrip analysis={analysis} timezone={timezone} />
      </div>

      <AnalysisPeriodChapter detail={detail} days={days} onDays={onDays} refreshing={refreshing} participantGroups={detail.participantGroups} />

      <TrackedFieldsChapter
        analysisId={analysis.id}
        fields={analysis.trackedFields}
        days={days}
        windowDays={detail.windowDays}
        timezone={timezone}
        version={version}
        onEdit={canConfigure ? onEdit : undefined}
      />

      <RunHistoryChapter
        analysis={analysis}
        participantGroups={detail.participantGroups}
        timezone={timezone}
        version={version}
        focusRunId={focusRunId}
        onFirstPage={onFirstPage}
      />

      <AnalysisConfigChapter analysis={analysis} timezone={timezone} />

      {children}
    </div>
  );
}
