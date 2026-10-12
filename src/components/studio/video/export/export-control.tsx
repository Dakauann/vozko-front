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
import { exportAt, exportKind, isAnimation, isFrame, MP4_EXPORT, type ExportKind, type VideoExportRequest } from "@/lib/studio/animated-export";
import { videoCanvasSize } from "@/lib/studio/document";
import { workArea } from "@/lib/studio/work-area";
import type { ExportFailureCode } from "@/lib/studio/export";
import { useWorkspace } from "@/contexts/workspace-context";
import { createDialogHref } from "@/lib/advertising/editor-entry";

import { useEditorState, useVideoEditor, useViewState } from "../editor-context";
import { useVideoExport } from "../use-video-export";
import { useClipLabeler, type ClipLabeler } from "../use-clip-label";
import { ExportSettings } from "./export-settings";
import type { VideoExportState } from "./video-exporter";

type Translate = ReturnType<typeof useTranslations>;

const ANIMATION_ERRORS: ReadonlySet<ExportFailureCode> = new Set(["no_encoder", "too_large"]);

const KIND_TEXT: Record<ExportKind, { done: string; result: string; inLibrary: string; fileName: string; encoding: string }> = {
  video: { done: "done", result: "result", inLibrary: "inLibrary", fileName: "fileName", encoding: "phase.encoding" },
  animation: { done: "doneAnimation", result: "resultAnimation", inLibrary: "inLibraryAnimation", fileName: "fileNameAnimation", encoding: "phaseAnimation" },
  frame: { done: "doneFrame", result: "resultFrame", inLibrary: "inLibraryFrame", fileName: "fileNameFrame", encoding: "phaseFrame" },
};

function progressLabel(state: VideoExportState, t: Translate): string | null {
  if (state.status !== "preparing") return null;
  return state.phase.phase === "encoding" ? t(KIND_TEXT[exportKind(state.request)].encoding) : t(`phase.${state.phase.phase}`);
}

function measuredProgress(state: VideoExportState): number | undefined {
  if (state.status !== "preparing" || state.phase.phase !== "encoding") return undefined;
  return Math.round((state.phase.done / Math.max(1, state.phase.total)) * 100);
}

type FailedExport = Extract<VideoExportState, { status: "failed" }>;

function failureText({ code, clip }: FailedExport, request: VideoExportRequest, t: Translate, label: ClipLabeler): string {
  if (code === "lut_unavailable") return clip ? t("errors.lut_unavailable", { name: label(clip) }) : t("errors.failed");
  if (isFrame(request) && code === "no_encoder") return t("frameErrors.no_encoder");
  return isAnimation(request) && ANIMATION_ERRORS.has(code) ? t(`animationErrors.${code}`) : t(`errors.${code}`);
}

function Running({ label, measured }: { label: string; measured?: number }) {
  const estimated = useEstimatedProgress();
  return <ProgressPanel label={label} progress={measured ?? estimated} className="h-24 w-full" />;
}

function Result({ url, request, t }: { url: string; request: VideoExportRequest; t: Translate }) {
  const kind = exportKind(request);
  if (kind !== "video") {
    return (
      <div className="overflow-hidden rounded-[--radius] bg-foreground">
        <img src={url} alt={t(KIND_TEXT[kind].result)} className="mx-auto max-h-64 object-contain" />
      </div>
    );
  }
  return <SoundVideo src={url} label={t("result")} controls className="overflow-hidden rounded-[--radius] bg-foreground" videoClassName="max-h-64 object-contain" />;
}

export function ExportControl() {
  const t = useTranslations("studio.video.export");
  const clipLabel = useClipLabeler();
  const [open, setOpen] = useState(false);
  const { state, start, reset } = useVideoExport();
  const duration = useEditorState((s) => s.document.durationMs);
  const canvas = useEditorState((s) => videoCanvasSize(s.document));
  const [request, setRequest] = useState<VideoExportRequest>(MP4_EXPORT);
  const [useArea, setUseArea] = useState(false);
  const { view } = useVideoEditor();
  const range = useViewState((s) => s.range);
  const area = workArea(range, duration);
  const playheadMs = useViewState((s) => s.playheadMs);
  const placed = exportAt(request, { playheadMs, durationMs: duration, range: useArea ? area : null });
  const begin = () => void start(exportAt(request, { playheadMs: view.getState().playheadMs, durationMs: duration, range: useArea ? area : null }));
  const label = progressLabel(state, t);
  const busy = label !== null;
  const { can, permissionsLoading } = useWorkspace();
  const canAdvertise = !permissionsLoading && can("ads", "create");
  const last = state.status === "idle" ? request : state.request;
  const kind = exportKind(last);
  const text = KIND_TEXT[kind];
  const adMedia = kind === "frame" ? "image" : kind === "video" ? "video" : null;

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
              if (state.status === "done" && state.outdated) {
                setOpen(true);
                void start(last);
              } else setOpen((current) => !current);
            }}
          />
        </span>
      </PopoverAnchor>
      <PopoverContent align="end" className="w-80 space-y-3">
        <p className="text-sm font-semibold text-foreground">{t("title")}</p>
        {label ? (
          <div aria-live="polite">
            <Running label={label} measured={measuredProgress(state)} />
          </div>
        ) : null}
        {state.status === "idle" ? (
          <ExportSettings request={request} canvas={canvas} moment={{ area, useArea, onUseArea: setUseArea, frameMs: isFrame(placed) ? placed.atMs : playheadMs }} onChange={setRequest} />
        ) : null}
        {state.status === "done" ? (
          <div className="space-y-3">
            {state.outdated ? (
              <div role="status" className="notice notice-warning space-y-2 px-2 py-1.5 text-xs">
                <p className="flex items-start gap-1.5">
                  <WarningCircle className="notice-ink mt-px h-4 w-4 shrink-0" aria-hidden />
                  <span className="notice-ink font-medium">{t("outdated.title")}</span>
                </p>
                <p className="text-foreground">{t("outdated.description")}</p>
                <Button variant="primary" size="sm" title={t("outdated.action")} onClick={() => void start(last)} />
              </div>
            ) : (
              <p role="status" className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                <CheckCircle className="h-4 w-4 text-healthy-ink" aria-hidden />
                {t(text.done)}
              </p>
            )}
            <Result url={state.result.mediaUrl} request={last} t={t} />
            <p className="text-xs text-muted-foreground">{t(text.inLibrary)}</p>
            <div className="flex flex-wrap items-center gap-2">
              <MediaDownloadButton mediaId={state.result.mediaId} description={t(text.fileName)} />
              {canAdvertise && adMedia && !state.outdated ? (
                <Link href={createDialogHref({ media: { kind: adMedia, mediaId: state.result.mediaId } })} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-ink hover:underline">
                  <Megaphone className="h-3.5 w-3.5" aria-hidden />
                  {t("useInAd")}
                </Link>
              ) : null}
            </div>
            {state.outdated ? null : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" title={t("again")} onClick={() => void start(last)} />
                <Button variant="ghost" size="sm" title={t("otherFormat")} onClick={() => { setRequest(last); reset(); }} />
              </div>
            )}
          </div>
        ) : null}
        {state.status === "failed" ? (
          <div className="space-y-3">
            <p role="alert" className="notice notice-fault flex items-start gap-1.5 px-2 py-1.5 text-xs">
              <WarningCircle className="notice-ink mt-px h-4 w-4 shrink-0" aria-hidden />
              <span className="text-foreground">{failureText(state, last, t, clipLabel)}</span>
            </p>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" title={t("retry")} onClick={() => void start(last)} />
              <Button variant="ghost" size="sm" title={t("close")} onClick={() => { setRequest(last); reset(); setOpen(false); }} />
            </div>
          </div>
        ) : null}
        {state.status === "idle" ? <Button variant="primary" size="sm" title={t("start")} onClick={begin} disabled={duration <= 0} /> : null}
      </PopoverContent>
    </Popover>
  );
}
