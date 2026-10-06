"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { isActionError } from "@/app/actions/action-result";
import { archiveStudioProjectAction, listStudioProjectsAction } from "@/app/actions/studio";
import { ChannelListPagination } from "@/components/channels/channel-list-parts";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { Tabs, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ArrowClockwise, Archive, Eye, FilmStrip, Image as ImageIcon, Palette, PencilSimple, Plus, WarningCircle } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useKeyedLoad } from "@/hooks/use-keyed-load";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "@/i18n/routing";
import type { StudioKind } from "@/lib/studio/document";
import { editorPathFor, type StudioProjectSummary } from "@/lib/studio/project";
import { cn } from "@/lib/utils";

import { CreateProjectDialog } from "./create-project-dialog";
import { RenameProjectDialog } from "./rename-project-dialog";

export const STUDIO_PAGE_SIZE = 20;

const KIND_ICON: Record<StudioKind, typeof ImageIcon> = { image: ImageIcon, video: FilmStrip };

function requestedKind(value: string | null): StudioKind | null {
  return value === "image" || value === "video" ? value : null;
}

const actionButton =
  "inline-flex items-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function StudioProjectsPage() {
  const t = useTranslations("studio");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const requested = requestedKind(useSearchParams().get("new"));
  const canCreate = useSettledPermission("media", "create");
  const canArchive = useSettledPermission("media", "delete");

  const [tab, setTab] = useState<StudioKind>(requested ?? "image");
  const [page, setPage] = useState(1);
  const [createKind, setCreateKind] = useState<StudioKind | null>(null);
  const [renaming, setRenaming] = useState<StudioProjectSummary | null>(null);
  const [archiving, setArchiving] = useState<StudioProjectSummary | null>(null);

  const [handledRequest, setHandledRequest] = useState<StudioKind | null>(null);
  if (requested !== handledRequest) {
    setHandledRequest(requested);
    if (requested) {
      setTab(requested);
      setPage(1);
      setCreateKind(requested);
    }
  }

  const load = useCallback(() => listStudioProjectsAction({ kind: tab, limit: STUDIO_PAGE_SIZE, offset: (page - 1) * STUDIO_PAGE_SIZE }), [tab, page]);
  const { value, loading, reload, update } = useKeyedLoad(`${tab}:${page}`, load);
  const failed = value !== null && isActionError(value) ? value : null;
  const listed = value !== null && !isActionError(value) ? value.data : null;
  const totalPages = listed ? Math.max(1, Math.ceil(listed.total / STUDIO_PAGE_SIZE)) : 1;

  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }), [locale]);

  const openCreate = useCallback((kind: StudioKind) => setCreateKind(kind), []);

  const closeCreate = useCallback(
    (open: boolean) => {
      if (open) return;
      setCreateKind(null);
      if (requested) router.replace("/dashboard/studio");
    },
    [requested, router],
  );

  const open = useCallback(
    (project: StudioProjectSummary) => {
      const path = editorPathFor(project);
      if (path) router.push(path);
    },
    [router],
  );

  const renamed = useCallback(
    (project: StudioProjectSummary) => {
      setRenaming(null);
      update((current) => (isActionError(current) ? current : { data: { ...current.data, items: current.data.items.map((item) => (item.id === project.id ? project : item)) } }));
      toast({ title: t("rename.done") });
    },
    [update, toast, t],
  );

  const archive = useCallback(async () => {
    if (!archiving) return;
    const result = await archiveStudioProjectAction(archiving.id);
    if (isActionError(result)) {
      toast({ title: t("archive.failed"), description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: t("archive.done") });
    reload();
  }, [archiving, toast, t, reload]);

  const columns = useMemo<DashboardTableColumn<StudioProjectSummary>[]>(
    () => [
      {
        key: "name",
        header: t("table.name"),
        render: (row) => {
          const Icon = KIND_ICON[row.kind];
          return (
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-[--radius] bg-muted text-muted-foreground" aria-hidden>
                <Icon className="h-4 w-4" />
              </span>
              <span className="truncate text-sm font-medium text-foreground">{row.name}</span>
            </div>
          );
        },
      },
      { key: "kind", header: t("table.kind"), render: (row) => <span className="text-sm text-muted-foreground">{t(`kinds.${row.kind}`)}</span> },
      {
        key: "updated",
        header: t("table.updated"),
        render: (row) => <span className="text-sm tabular-nums text-muted-foreground">{dateFormat.format(new Date(row.updatedAt))}</span>,
      },
    ],
    [t, dateFormat],
  );

  const renderRowActions = useCallback(
    (row: StudioProjectSummary) => (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            open(row);
          }}
          title={t("table.open")}
          aria-label={t("table.open")}
          className={actionButton}
        >
          <Eye className="h-4 w-4" />
        </button>
        {canCreate ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setRenaming(row);
            }}
            title={t("table.rename")}
            aria-label={t("table.rename")}
            className={actionButton}
          >
            <PencilSimple className="h-4 w-4" />
          </button>
        ) : null}
        {canArchive ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setArchiving(row);
            }}
            title={t("table.archive")}
            aria-label={t("table.archive")}
            className={cn(actionButton, "hover:text-destructive-ink")}
          >
            <Archive className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    ),
    [canCreate, canArchive, open, t],
  );

  const createButtons = canCreate ? (
    <>
      <Button variant="primary" title={t("page.createImage")} icon={<Plus weight="bold" className="h-4 w-4" />} iconVisible iconSide="left" onClick={() => openCreate("image")} />
      <Button variant="outline" title={t("page.createVideo")} icon={<Plus weight="bold" className="h-4 w-4" />} iconVisible iconSide="left" onClick={() => openCreate("video")} />
    </>
  ) : undefined;

  const EmptyIcon = KIND_ICON[tab];

  return (
    <div className="w-full space-y-6">
      <DashboardPageHeader badge={t("page.title")} description={t("page.description")} icon={<Palette className="h-6 w-6" />} actions={createButtons} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs
          value={tab}
          onValueChange={(next) => {
            setTab(next as StudioKind);
            setPage(1);
          }}
        >
          <TabsList className="min-w-0">
            <TabsTrigger value="image">
              <ImageIcon className="h-4 w-4" aria-hidden />
              {t("tabs.image")}
            </TabsTrigger>
            <TabsTrigger value="video">
              <FilmStrip className="h-4 w-4" aria-hidden />
              {t("tabs.video")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          variant="ghost"
          title=""
          aria-label={t("page.refresh")}
          icon={<ArrowClockwise weight="bold" className={cn("h-4 w-4", loading && "animate-spin")} />}
          iconVisible
          onClick={reload}
          disabled={loading}
        />
      </div>

      {failed ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[--radius] border border-border bg-muted px-4 py-3 text-sm text-destructive-ink">
          <WarningCircle className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">{t("list.failed")}</span>
          <Button variant="outline" size="sm" title={t("list.retry")} onClick={reload} />
        </div>
      ) : loading || !listed ? (
        <DashboardTable<StudioProjectSummary> data={[]} columns={columns} rowKey={(row) => row.id} loading />
      ) : listed.items.length === 0 ? (
        <DashboardTable<StudioProjectSummary>
          data={[]}
          columns={columns}
          rowKey={(row) => row.id}
          emptyState={{
            icon: <EmptyIcon className="h-7 w-7 opacity-40" />,
            title: t(`empty.${tab}.title`),
            description: t(`empty.${tab}.description`),
            action: canCreate ? (
              <div className="mt-2">
                <Button variant="primary" title={tab === "image" ? t("page.createImage") : t("page.createVideo")} icon={<Plus weight="bold" className="h-4 w-4" />} iconVisible iconSide="left" onClick={() => openCreate(tab)} />
              </div>
            ) : undefined,
          }}
        />
      ) : (
        <div className="space-y-4">
          <ElevatedContainer className="overflow-hidden rounded-lg border border-border !p-0">
            <DashboardTable<StudioProjectSummary>
              data={listed.items}
              columns={columns}
              rowKey={(row) => row.id}
              onRowClick={open}
              renderRowActions={renderRowActions}
              className="rounded-none border-0 shadow-none"
            />
          </ElevatedContainer>
          <ChannelListPagination
            page={page}
            totalPages={totalPages}
            loading={loading}
            labels={{ pageOf: t("pagination.pageOf", { page, totalPages }), previous: t("pagination.previous"), next: t("pagination.next") }}
            onPage={setPage}
          />
        </div>
      )}

      <CreateProjectDialog open={createKind !== null} kind={createKind ?? tab} onKindChange={setCreateKind} onOpenChange={closeCreate} />
      <RenameProjectDialog project={renaming} onClose={() => setRenaming(null)} onRenamed={renamed} />
      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(next) => {
          if (!next) setArchiving(null);
        }}
        title={t("archive.title")}
        description={t("archive.description", { name: archiving?.name ?? "" })}
        confirmLabel={t("archive.confirm")}
        cancelLabel={t("archive.cancel")}
        onConfirm={archive}
      />
    </div>
  );
}
