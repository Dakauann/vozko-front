"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { CheckCircle, CircleNotch, DownloadSimple, Megaphone, WarningCircle } from "@/components/icons";
import { MediaDownloadButton } from "@/components/media/media-download-button";
import { SoundVideo } from "@/components/media/sound-video";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { ProgressPanel } from "@/components/ui/progress-panel";
import { useEstimatedProgress } from "@/hooks/use-estimated-progress";
import { Link } from "@/i18n/routing";
import { pathForScreen } from "@/lib/navigation/routes";

import { useEditorState } from "../editor-context";
import { useVideoExport, type VideoExportState } from "../use-video-export";

const KNOWN_FAILURES = new Set([
  "empty",
  "unsaved",
  "raster_failed",
  "upload_failed",
  "too_many_jobs",
  "not_rasterized",
  "invalid",
  "conflict",
  "changed",
  "insufficient_funds",
  "timed_out",
  "generation_failed",
  "storage_failed",
  "enqueue_failed",
]);

function progressLabel(state: VideoExportState, t: ReturnType<typeof useTranslations>): string | null {
  switch (state.status) {
    case "preparing":
      if (state.phase.phase === "rasterizing") return t("phase.rasterizing", { done: state.phase.done, total: state.phase.total });
      return t(`phase.${state.phase.phase}`);
    case "queued":
      return t("phase.queued");
    case "rendering":
      return t("phase.rendering");
    case "finalizing":
      return t("phase.finalizing");
  }
  return null;
}

function Running({ label }: { label: string }) {
  const progress = useEstimatedProgress();
  return <ProgressPanel label={label} progress={progress} className="h-24 w-full" />;
}

export function ExportControl() {
  const t = useTranslations("studio.video.export");
  const [open, setOpen] = useState(false);
  const { state, start, reset } = useVideoExport();
  const duration = useEditorState((s) => s.document.durationMs);
  const label = progressLabel(state, t);
  const busy = label !== null;
  const adsPath = pathForScreen("ads_create");

  const run = () => {
    setOpen(true);
    void start();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <span data-tour="studio-video-export" className="inline-flex">
          <Button
            variant="primary"
            size="sm"
            title={busy ? t("exporting") : t("button")}
            icon={busy ? <CircleNotch className="h-3.5 w-3.5 animate-spin" /> : <DownloadSimple className="h-3.5 w-3.5" />}
            iconVisible
            disabled={duration <= 0 && !busy && state.status === "idle"}
            onClick={() => {
              if (state.status === "done" && state.outdated) run();
              else if (busy || state.status === "done" || state.status === "failed") setOpen((current) => !current);
              else run();
            }}
          />
        </span>
      </PopoverAnchor>
      <PopoverContent align="end" className="w-80 space-y-3">
        <p className="text-sm font-semibold text-foreground">{t("title")}</p>
        {label ? (
          <div aria-live="polite">
            <Running label={label} />
          </div>
        ) : null}
        {state.status === "idle" ? <p className="text-xs text-muted-foreground">{t("hint")}</p> : null}
        {state.status === "done" ? (
          <div className="space-y-3">
            {state.outdated ? (
              <div role="status" className="notice notice-warning space-y-2 px-2 py-1.5 text-xs">
                <p className="flex items-start gap-1.5">
                  <WarningCircle className="notice-ink mt-px h-4 w-4 shrink-0" aria-hidden />
                  <span className="notice-ink font-medium">{t("outdated.title")}</span>
                </p>
                <p className="text-foreground">{t("outdated.description")}</p>
                <Button variant="primary" size="sm" title={t("outdated.action")} onClick={() => void start()} />
              </div>
            ) : (
              <p role="status" className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                <CheckCircle className="h-4 w-4 text-healthy-ink" aria-hidden />
                {t("done")}
              </p>
            )}
            <SoundVideo src={state.result.mediaUrl} label={t("result")} controls className="overflow-hidden rounded-[--radius] bg-foreground" videoClassName="max-h-64 object-contain" />
            <p className="text-xs text-muted-foreground">{t("inLibrary")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <MediaDownloadButton mediaId={state.result.mediaId} description={t("fileName")} />
              {adsPath ? (
                <Link href={adsPath} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-ink hover:underline">
                  <Megaphone className="h-3.5 w-3.5" aria-hidden />
                  {t("useInAd")}
                </Link>
              ) : null}
            </div>
            {state.outdated ? null : <Button variant="outline" size="sm" title={t("again")} onClick={() => void start()} />}
          </div>
        ) : null}
        {state.status === "failed" ? (
          <div className="space-y-3">
            <p role="alert" className="notice notice-fault flex items-start gap-1.5 px-2 py-1.5 text-xs">
              <WarningCircle className="notice-ink mt-px h-4 w-4 shrink-0" aria-hidden />
              <span className="text-foreground">{t(`errors.${KNOWN_FAILURES.has(state.code) ? state.code : "unknown"}`)}</span>
            </p>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" title={t("retry")} onClick={() => void start()} />
              <Button variant="ghost" size="sm" title={t("close")} onClick={() => { reset(); setOpen(false); }} />
            </div>
          </div>
        ) : null}
        {state.status === "idle" ? <Button variant="primary" size="sm" title={t("start")} onClick={() => void start()} disabled={duration <= 0} /> : null}
      </PopoverContent>
    </Popover>
  );
}
