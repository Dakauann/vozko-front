"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import { ArrowCounterClockwise, ArrowsClockwise, CircleNotch, X } from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { ListPager } from "@/components/elevated-design/list-pager";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import { listWorkflowVersionsAction } from "@/app/actions/workflows";
import { useAssignableMembers } from "@/hooks/use-assignable-members";
import { usePagedList } from "@/hooks/use-paged-list";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import { liveVersionMark, versionTag, type PublicationFacts } from "@/lib/workflows/publication";

import { DateTimeText } from "./run-bits";

const PAGE_SIZE = 20;

export interface WorkflowVersionsPanelProps {
  workflowId: string;
  publication: PublicationFacts;
  reloadToken: number;
  hasLocalEdits: boolean;
  onRestore: (version: number) => Promise<boolean>;
  onClose: () => void;
}

export function WorkflowVersionsPanel({
  workflowId,
  publication,
  reloadToken,
  hasLocalEdits,
  onRestore,
  onClose,
}: WorkflowVersionsPanelProps) {
  const t = useTranslations("workflowsPage.versions");
  const canRestore = useSettledPermission("workflows", "update");
  const canReadMembers = useSettledPermission("members", "read");
  const { names } = useAssignableMembers(canReadMembers);
  const [restoreTarget, setRestoreTarget] = useState<number | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const readVersions = useCallback(
    async (page: number) => {
      const res = await listWorkflowVersionsAction(workflowId, { page, pageSize: PAGE_SIZE });
      return { items: res.versions, meta: res.meta, error: res.error };
    },
    [workflowId],
  );
  const list = usePagedList({ scope: `${workflowId}|${reloadToken}`, read: readVersions });
  const { items: versions, loading, page, setPage, totalPages, refresh } = list;

  const confirmRestore = async () => {
    if (restoreTarget === null) return false;
    const restored = await onRestore(restoreTarget);
    if (restored) refresh();
    return restored;
  };

  return (
    <aside aria-label={t("title")} className="flex w-[360px] shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <span className="text-sm font-semibold text-foreground">{t("title")}</span>
        <div className="flex-1" />
        <ElevatedButton
          variant="ghost"
          size="icon"
          iconVisible
          icon={<ArrowsClockwise size={14} />}
          aria-label={t("refresh")}
          title=""
          onClick={refresh}
          className="h-7 w-7"
        />
        <ElevatedButton
          variant="ghost"
          size="icon"
          iconVisible
          icon={<X size={14} />}
          aria-label={t("close")}
          title=""
          onClick={onClose}
          className="h-7 w-7"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
            <CircleNotch size={14} className="animate-spin" />
          </div>
        )}
        {!loading && list.error && (
          <div className="space-y-2 p-3">
            <Notice tone="fault">{t("loadError")}</Notice>
            <ElevatedButton variant="outline-subtle" size="sm" title={t("retry")} onClick={refresh} />
          </div>
        )}
        {!loading && !list.error && versions.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">{t("empty")}</p>
        )}
        {!loading && !list.error && versions.length > 0 && (
          <ul className="divide-y divide-border">
            {versions.map((version) => {
              const mark = liveVersionMark(version.version, publication);
              const publisher = version.publishedBy ? names.get(version.publishedBy) : undefined;
              return (
                <li key={version.id} className="space-y-1.5 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="readout text-sm font-semibold tabular-nums text-foreground">{versionTag(version.version)}</span>
                    {mark === "live" && (
                      <StatusChip tone="healthy" label={t("live")} className="px-2 text-2xs" />
                    )}
                    {mark === "paused" && (
                      <StatusChip tone="warning" label={t("paused")} className="px-2 text-2xs" />
                    )}
                    <div className="flex-1" />
                    {canRestore && (
                      <ElevatedButton
                        variant="ghost"
                        size="sm"
                        iconVisible
                        icon={<ArrowCounterClockwise size={12} />}
                        title={t("restore")}
                        onClick={() => {
                          setRestoreTarget(version.version);
                          setRestoreOpen(true);
                        }}
                      />
                    )}
                  </div>
                  <div className="flex items-baseline justify-between gap-3 text-2xs">
                    <span className="shrink-0 text-muted-foreground">{t("publishedAt")}</span>
                    <DateTimeText value={version.publishedAt} className="min-w-0 truncate text-right text-foreground" />
                  </div>
                  <div className="flex items-baseline justify-between gap-3 text-2xs">
                    <span className="shrink-0 text-muted-foreground">{t("publishedBy")}</span>
                    {publisher ? (
                      <span className="min-w-0 truncate text-right text-foreground">{publisher}</span>
                    ) : (
                      <EmptyValue />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ListPager
        page={page}
        totalPages={totalPages}
        onPage={setPage}
        disabled={loading}
        previousLabel={t("previous")}
        nextLabel={t("next")}
        pageLabel={t("page", { page, total: totalPages })}
        className="border-t border-border px-3 py-2"
      />

      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title={t("restoreTitle", { version: restoreTarget ?? 0 })}
        description={
          <>
            {t("restoreDescription", { version: restoreTarget ?? 0 })}
            {hasLocalEdits && (
              <>
                {" "}
                {t("restoreDiscards")}
              </>
            )}
          </>
        }
        confirmLabel={t("restoreConfirm")}
        cancelLabel={t("restoreKeep")}
        tone="default"
        onConfirm={confirmRestore}
      />
    </aside>
  );
}
