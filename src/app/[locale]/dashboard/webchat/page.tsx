"use client";

import { ArrowClockwise, Eye, MagnifyingGlass, Plus, Trash, Warning } from "@/components/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import { useRouter } from "next/navigation";

import { deleteWebchatWidgetAction, listWebchatWidgetsAction } from "@/app/actions/webchat";
import { originsSummary, type WebchatWidget, type WebchatWidgetListMeta } from "@/lib/webchat/types";

import Button from "@/components/elevated-design/button";
import { ChannelListPagination, ChannelListStat } from "@/components/channels/channel-list-parts";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import Link from "next/link";
import { WebchatLogoColor } from "@/components/icons/channel-logos";
import { WebchatStatusChip } from "@/components/webchat/webchat-status-chip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const ITEMS_PER_PAGE = 15;

type ListResult = Awaited<ReturnType<typeof listWebchatWidgetsAction>>;

export default function WebchatWidgetsPage() {
  const t = useTranslations("webchat");
  const locale = useLocale();
  const { can } = useWorkspace();
  const router = useRouter();

  const [widgets, setWidgets] = useState<WebchatWidget[]>([]);
  const [meta, setMeta] = useState<WebchatWidgetListMeta>({ page: 1, pageSize: ITEMS_PER_PAGE, totalPages: 0, totalItems: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WebchatWidget | null>(null);

  const canCreate = can("webchat_widgets", "create");
  const canDelete = can("webchat_widgets", "delete");

  const apply = useCallback((result: ListResult) => {
    setLoading(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setWidgets(result.widgets);
    setMeta(result.meta);
  }, []);

  const fetchWidgets = useCallback(
    (page: number, term: string) => {
      setLoading(true);
      void listWebchatWidgetsAction(page, ITEMS_PER_PAGE, term || undefined).then(apply);
    },
    [apply],
  );

  useEffect(() => {
    void listWebchatWidgetsAction(1, ITEMS_PER_PAGE).then(apply);
  }, [apply]);

  const handleDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const result = await deleteWebchatWidgetAction(pendingDelete.id);
    if ("error" in result) {
      toast.error(t("danger.deleteFailed"), { description: result.error });
      return;
    }
    toast(t("danger.deleted", { name: pendingDelete.name }));
    fetchWidgets(meta.page, search);
  }, [pendingDelete, t, fetchWidgets, meta.page, search]);

  const activeCount = widgets.filter((w) => w.status === "active").length;
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }), [locale]);

  const columns = useMemo<DashboardTableColumn<WebchatWidget>[]>(
    () => [
      {
        key: "name",
        header: t("table.name"),
        render: (row) => (
          <div className="flex items-center gap-2.5">
            <WebchatLogoColor className="size-7 shrink-0" />
            <span className="text-sm font-medium text-foreground">{row.name}</span>
          </div>
        ),
      },
      {
        key: "sites",
        header: t("table.sites"),
        render: (row) => {
          const summary = originsSummary(row.allowedOrigins);
          if (!summary.first) return <span className="text-xs text-muted-foreground">{t("table.noSites")}</span>;
          return (
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-mono text-xs text-foreground">{summary.first}</span>
              {summary.more > 0 && (
                <span className="shrink-0 text-xs text-muted-foreground">{t("table.moreSites", { count: summary.more })}</span>
              )}
            </div>
          );
        },
      },
      {
        key: "status",
        header: t("table.status"),
        render: (row) => <WebchatStatusChip status={row.status} />,
      },
      {
        key: "created",
        header: t("table.created"),
        render: (row) => (
          <span className="text-sm tabular-nums text-muted-foreground">{dateFormat.format(new Date(row.createdAt))}</span>
        ),
      },
    ],
    [t, dateFormat],
  );

  const renderRowActions = useCallback(
    (row: WebchatWidget) => (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/dashboard/webchat/${row.id}`);
          }}
          title={t("table.open")}
          aria-label={t("table.open")}
          className="inline-flex items-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Eye className="h-4 w-4" />
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPendingDelete(row);
            }}
            title={t("danger.delete")}
            aria-label={t("danger.delete")}
            className="inline-flex items-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive-ink"
          >
            <Trash className="h-4 w-4" />
          </button>
        )}
      </div>
    ),
    [canDelete, router, t],
  );

  const createButton = canCreate ? (
    <Link href="/dashboard/webchat/new">
      <Button
        variant="primary"
        title={t("page.create")}
        icon={<Plus weight="bold" className="h-4 w-4" />}
        iconVisible
        iconSide="left"
      />
    </Link>
  ) : undefined;

  return (
    <div className="w-full space-y-6">
      <DashboardPageHeader
        badge={t("page.title")}
        description={t("page.description")}
        icon={<WebchatLogoColor className="h-6 w-6" />}
        colorClass="text-info-ink"
        actions={createButton}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-[--radius] border border-border bg-card px-5 py-3 shadow-sm">
        <div className="relative w-full max-w-xs">
          <ElevatedInput
            type="text"
            label={t("page.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") fetchWidgets(1, search);
            }}
            icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
            controlSize="sm"
            className="w-full"
          />
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-4">
          <ChannelListStat label={t("stats.total")} value={loading ? "…" : meta.totalItems} />
          <ChannelListStat label={t("stats.active")} value={loading ? "…" : activeCount} />
        </div>

        <Button
          variant="ghost"
          title=""
          aria-label={t("page.refresh")}
          icon={<ArrowClockwise weight="bold" className={cn("h-4 w-4", loading && "animate-spin")} />}
          iconVisible
          iconSide="left"
          onClick={() => fetchWidgets(meta.page, search)}
          disabled={loading}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-destructive-ink">
          <Warning className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading ? (
        <DashboardTable<WebchatWidget> data={[]} columns={columns} rowKey={(row) => row.id} loading />
      ) : widgets.length === 0 ? (
        <DashboardTable<WebchatWidget>
          data={[]}
          columns={columns}
          rowKey={(row) => row.id}
          emptyState={{
            icon: <WebchatLogoColor className="h-7 w-7 opacity-40" />,
            title: search ? t("page.noResultsTitle") : t("page.emptyTitle"),
            description: search ? t("page.noResultsDescription") : t("page.emptyDescription"),
            action: !search && createButton ? <div className="mt-2 flex items-center gap-3">{createButton}</div> : undefined,
          }}
        />
      ) : (
        <div className="space-y-4">
          <ElevatedContainer className="rounded-lg overflow-hidden border border-border !p-0">
            <DashboardTable<WebchatWidget>
              data={widgets}
              columns={columns}
              rowKey={(row) => row.id}
              onRowClick={(row) => router.push(`/dashboard/webchat/${row.id}`)}
              renderRowActions={renderRowActions}
              className="rounded-none border-0 shadow-none"
            />
          </ElevatedContainer>

          <ChannelListPagination
            page={meta.page}
            totalPages={meta.totalPages}
            loading={loading}
            labels={{
              pageOf: t("pagination.pageOf", { page: meta.page, totalPages: meta.totalPages }),
              previous: t("pagination.previous"),
              next: t("pagination.next"),
            }}
            onPage={(next) => fetchWidgets(next, search)}
          />
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t("danger.confirmTitle")}
        description={t("danger.confirmDescription", { name: pendingDelete?.name ?? "" })}
        confirmLabel={t("danger.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleDelete}
      />
    </div>
  );
}
