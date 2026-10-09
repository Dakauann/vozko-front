"use client";

import { useTranslations } from "next-intl";

import { CaretLeft, CaretRight, Pause, Play } from "@/components/icons";
import { formatTimecode } from "@/lib/studio/timeline-view";

import { useEditorState, useVideoEditor, useViewState } from "../editor-context";
import { PlayheadTimecode } from "../playhead-timecode";
import { ToolButton } from "../tool-button";

export function Transport() {
  const t = useTranslations("studio.video.transport");
  const { playback } = useVideoEditor();
  const playing = useViewState((s) => s.playing);
  const rate = useViewState((s) => s.rate);
  const durationMs = useEditorState((s) => s.document.durationMs);

  return (
    <div className="flex h-10 shrink-0 items-center justify-center gap-1 border-t border-border bg-card px-3">
      <ToolButton label={t("start")} shortcut="Home" icon={<CaretLeft className="h-4 w-4" weight="bold" />} onClick={() => playback.seek(0)} />
      <ToolButton
        label={playing ? t("pause") : t("play")}
        shortcut={t("space")}
        icon={playing ? <Pause className="h-4 w-4" weight="fill" /> : <Play className="h-4 w-4" weight="fill" />}
        disabled={durationMs <= 0}
        onClick={() => playback.toggle()}
        className="text-foreground"
      />
      <ToolButton label={t("end")} shortcut="End" icon={<CaretRight className="h-4 w-4" weight="bold" />} onClick={() => playback.seek(durationMs)} />
      <span className="ml-2 font-mono text-xs tabular-nums text-foreground" aria-live="off">
        <PlayheadTimecode format={formatTimecode} />
        <span className="text-muted-foreground"> / {formatTimecode(durationMs)}</span>
      </span>
      {playing && rate !== 1 ? <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-2xs font-medium tabular-nums text-muted-foreground">{`${rate}x`}</span> : null}
    </div>
  );
}
