"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { sourceAt } from "@/lib/studio/clip-time";
import { quantizeMs, type Clip } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";
import { formatTimecode } from "@/lib/studio/timeline-view";
import { trimPreviewFrames, type TrimFrame, type TrimMode } from "@/lib/studio/trim-edits";
import { cn } from "@/lib/utils";

import { useEditorState, useViewState } from "../editor-context";
import { useFrame } from "../timeline/filmstrip";
import { useAssetUrl } from "../use-asset";

const FRAME_PX = 240;

const FRAME_LABELS: Record<TrimMode, string[][]> = {
  roll: [["outgoing", "incoming"]],
  slide: [
    ["clipFirst", "clipLast"],
    ["previousLast", "nextFirst"],
  ],
};

function useSteadyUrl(url: string | null): string | null {
  const [last, setLast] = useState<string | null>(null);
  if (url && url !== last) setLast(url);
  return url ?? last;
}

function VideoStill({ clip, localMs }: { clip: Clip; localMs: number }) {
  const url = useSteadyUrl(useFrame(clip.assetId!, quantizeMs(sourceAt(clip, localMs)), FRAME_PX));
  return url ? <img src={url} alt="" draggable={false} className="h-full w-full object-contain" /> : null;
}

function ImageStill({ clip }: { clip: Clip }) {
  const url = useAssetUrl(clip.assetId);
  return url ? <img src={url} alt="" draggable={false} className="h-full w-full object-contain" /> : null;
}

function FrameCell({ frame, label }: { frame: TrimFrame | null; label: string }) {
  const t = useTranslations("studio.video.preview.trim");
  const clip = useEditorState((s) => (frame ? findClip(s.document, frame.clipId)?.clip : undefined));
  return (
    <figure className={cn("relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-[4px] bg-muted ring-1", frame?.live ? "ring-primary" : "ring-border")}>
      {clip && frame && clip.type === "video" && clip.assetId ? <VideoStill clip={clip} localMs={frame.localMs} /> : null}
      {clip && clip.type === "image" ? <ImageStill clip={clip} /> : null}
      {clip && clip.type !== "video" && clip.type !== "image" ? <span className="text-xs text-muted-foreground">{t("element")}</span> : null}
      {clip ? null : <span className="text-xs text-muted-foreground">{t("gap")}</span>}
      <figcaption className="absolute inset-x-0 bottom-0 bg-card/85 px-1.5 py-0.5 text-2xs text-foreground">
        {label}
        {clip && frame ? <span className="ml-1 font-mono tabular-nums text-muted-foreground">{formatTimecode(clip.startMs + frame.localMs)}</span> : null}
      </figcaption>
    </figure>
  );
}

export function TrimPreviewOverlay() {
  const t = useTranslations("studio.video.preview.trim");
  const preview = useViewState((s) => s.trimPreview);
  const document = useEditorState((s) => s.document);
  const rows = preview ? trimPreviewFrames(document, preview) : null;
  if (!preview || !rows) return null;
  const shown = rows.flat().filter((frame): frame is TrimFrame => frame !== null);
  if (shown.every((frame) => findClip(document, frame.clipId)?.clip.type === "audio")) return null;
  return (
    <div role="status" aria-label={t(preview.mode)} data-trim-preview={preview.mode} className="pointer-events-none absolute inset-0 z-[900] flex flex-col gap-2 bg-background/90 p-3">
      {rows.map((row, r) => (
        <div key={r} className="flex min-h-0 flex-1 gap-2">
          {row.map((frame, i) => (
            <FrameCell key={i} frame={frame} label={t(FRAME_LABELS[preview.mode][r][i])} />
          ))}
        </div>
      ))}
    </div>
  );
}
