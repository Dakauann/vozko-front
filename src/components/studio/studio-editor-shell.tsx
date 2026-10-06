"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ScreenLoader } from "@/components/brand/screen-loader";
import Button from "@/components/elevated-design/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ArrowClockwise, ArrowLeft, Check, CircleNotch, Warning, WarningCircle } from "@/components/icons";
import { useStudioProject, type StudioProjectHandle, type StudioSaveStatus } from "@/hooks/use-studio-project";
import { Link } from "@/i18n/routing";
import type { DocumentOf, StudioKind } from "@/lib/studio/document";
import type { StudioProject } from "@/lib/studio/project";
import { cn } from "@/lib/utils";

export interface StudioEditorMountProps<K extends StudioKind> {
  project: StudioProject<DocumentOf<K>>;
  studio: StudioProjectHandle<K>;
}

interface StudioEditorShellProps<K extends StudioKind> {
  projectId: string;
  kind: K;
  children: (props: StudioEditorMountProps<K>) => ReactNode;
}

const STATUS_TONE: Record<StudioSaveStatus, string> = {
  saved: "text-muted-foreground",
  saving: "text-muted-foreground",
  unsaved: "text-muted-foreground",
  conflict: "text-warning-ink",
  error: "text-destructive-ink",
};

function SaveIndicator<K extends StudioKind>({ studio }: { studio: StudioProjectHandle<K> }) {
  const t = useTranslations("studio.editor");
  const icon =
    studio.saveStatus === "saving" ? (
      <CircleNotch className="h-3.5 w-3.5 animate-spin" aria-hidden />
    ) : studio.saveStatus === "saved" ? (
      <Check className="h-3.5 w-3.5" aria-hidden />
    ) : studio.saveStatus === "unsaved" ? null : (
      <WarningCircle className="h-3.5 w-3.5" aria-hidden />
    );
  return (
    <div className="flex items-center gap-2">
      <span role="status" aria-live="polite" className={cn("inline-flex items-center gap-1.5 text-xs", STATUS_TONE[studio.saveStatus])}>
        {icon}
        {t(`status.${studio.saveStatus}`)}
      </span>
      {studio.saveStatus === "error" ? (
        <Button variant="ghost" size="sm" title={t("retrySave")} icon={<ArrowClockwise className="h-3.5 w-3.5" />} iconVisible onClick={studio.retrySave} />
      ) : null}
    </div>
  );
}

function ConflictBanner<K extends StudioKind>({ studio }: { studio: StudioProjectHandle<K> }) {
  const t = useTranslations("studio.editor.conflict");
  if (!studio.conflict) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-muted px-4 py-2.5">
      <Warning className="h-4 w-4 shrink-0 text-warning-ink" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{t("title")}</p>
        <p className="text-xs text-muted-foreground">{t("description")}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span id="studio-conflict-reload" className="sr-only">
          {t("reloadHint")}
        </span>
        <span id="studio-conflict-keep" className="sr-only">
          {t("keepMineHint")}
        </span>
        <Button variant="outline" size="sm" title={t("reload")} aria-describedby="studio-conflict-reload" onClick={studio.reloadFromServer} />
        <Button variant="primary" size="sm" title={t("keepMine")} aria-describedby="studio-conflict-keep" onClick={studio.keepMine} />
      </div>
    </div>
  );
}

function LoadFailure<K extends StudioKind>({ studio }: { studio: StudioProjectHandle<K> }) {
  const t = useTranslations("studio.editor");
  if (studio.load.status !== "failed") return null;
  const { error, issue } = studio.load;
  const message = issue ? t("invalid", { field: issue.field, code: issue.code }) : error?.status === 404 ? t("notFound") : t("loadFailed");
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <WarningCircle className="h-6 w-6 text-destructive-ink" aria-hidden />
      <p role="alert" className="max-w-md text-sm text-foreground">
        {message}
      </p>
      {issue || error?.status === 404 ? null : (
        <Button variant="outline" size="sm" title={t("retry")} icon={<ArrowClockwise className="h-3.5 w-3.5" />} iconVisible onClick={studio.reload} />
      )}
    </div>
  );
}

export function StudioEditorShell<K extends StudioKind>({ projectId, kind, children }: StudioEditorShellProps<K>) {
  const t = useTranslations("studio.editor");
  const studio = useStudioProject(projectId, kind);

  return (
    <TooltipProvider delayDuration={400}>
      <div className="relative -m-3 flex h-[calc(100dvh_-_var(--dashboard-header-h))] min-h-[480px] w-[calc(100%+1.5rem)] flex-col overflow-hidden bg-background sm:-m-6 sm:w-[calc(100%+3rem)]">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-3">
          <Link
            href="/dashboard/studio"
            className="legend inline-flex shrink-0 items-center gap-1 rounded-[--radius] px-1 py-0.5 transition-colors hover:!text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-3 w-3" weight="bold" aria-hidden />
            {t("back")}
          </Link>
          <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
          <h1 className="min-w-0 truncate text-sm font-semibold text-foreground">{studio.name ?? ""}</h1>
          <div className="ml-auto shrink-0">{studio.load.status === "ready" ? <SaveIndicator studio={studio} /> : null}</div>
        </header>
        <ConflictBanner studio={studio} />
        <div className="flex min-h-0 flex-1">
          <div className="relative min-w-0 flex-1">
            {studio.load.status === "loading" ? <ScreenLoader fit="fill" label={t("loading")} /> : null}
            {studio.load.status === "failed" ? <LoadFailure studio={studio} /> : null}
            {studio.load.status === "ready" ? <div key={studio.generation} className="h-full">{children({ project: studio.load.project, studio })}</div> : null}
          </div>
          <div aria-hidden data-edge-tab-rail className="w-9 shrink-0 border-l border-border bg-card" />
        </div>
      </div>
    </TooltipProvider>
  );
}
