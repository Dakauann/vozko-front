"use client";

import { useFormatter, useTranslations } from "next-intl";

import { CaretLeft, CaretRight, Pause, Play } from "@/components/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PREVIEW_RATES } from "@/lib/studio/playback";
import { formatTimecode } from "@/lib/studio/timeline-view";

import { useEditorState, useVideoEditor, useViewState } from "../editor-context";
import { PlayheadTimecode } from "../playhead-timecode";
import { ToolButton, ToolDivider } from "../tool-button";
import { PreviewQualityMenu, PreviewZoomControls, TRANSPORT_MENU_TRIGGER, TransparencyGridToggle, WorkAreaPlayback } from "./view-controls";

function PreviewSpeed() {
  const t = useTranslations("studio.video.transport");
  const format = useFormatter();
  const { playback } = useVideoEditor();
  const previewRate = useViewState((s) => s.previewRate);
  const speed = (rate: number) => t("rate", { rate: format.number(rate, { maximumFractionDigits: 2 }) });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("speed", { rate: speed(previewRate) })}
          className={TRANSPORT_MENU_TRIGGER}
        >
          {speed(previewRate)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-2xs font-normal text-muted-foreground">{t("speedHint")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={String(previewRate)} onValueChange={(value) => playback.setPreviewRate(Number(value))}>
          {PREVIEW_RATES.map((rate) => (
            <DropdownMenuRadioItem key={rate} value={String(rate)} className="font-mono text-xs tabular-nums">
              {speed(rate)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Transport() {
  const t = useTranslations("studio.video.transport");
  const { playback } = useVideoEditor();
  const playing = useViewState((s) => s.playing);
  const rate = useViewState((s) => s.rate);
  const previewRate = useViewState((s) => s.previewRate);
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
      <ToolDivider />
      <WorkAreaPlayback />
      <span className="ml-2 font-mono text-xs tabular-nums text-foreground" aria-live="off">
        <PlayheadTimecode format={formatTimecode} />
        <span className="text-muted-foreground"> / {formatTimecode(durationMs)}</span>
      </span>
      <PreviewSpeed />
      <PreviewQualityMenu />
      <TransparencyGridToggle />
      <PreviewZoomControls />
      {playing && rate !== previewRate ? <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-2xs font-medium tabular-nums text-muted-foreground">{`${rate}x`}</span> : null}
    </div>
  );
}
