"use client";

import type { ComponentType, SVGProps } from "react";
import { useTranslations } from "next-intl";

import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { ArrowsInSimple, FlagCheckered, Link, LinkBreak, MagnifyingGlass, Minus, Plus, Question, Stack, Target, VideoCamera, Waveform } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TrackKind } from "@/lib/studio/document";
import { formatSmpte, sliderToZoom, zoomToSlider } from "@/lib/studio/timeline-view";
import { SHORTCUT_ROWS } from "@/lib/studio/video-shortcuts";
import { cn } from "@/lib/utils";

import { useEditorState, useVideoEditor, useViewState } from "../editor-context";
import { RANGE_KEYS } from "../inspector/fields";
import { ToolButton, ToolDivider } from "../tool-button";
import type { DragMode, TimelineTool, TrackHeight } from "../view-store";
import { BladeToolIcon, RippleToolIcon, RollToolIcon, SelectToolIcon, SlideToolIcon, SlipToolIcon } from "./tool-icons";

const HEIGHTS: TrackHeight[] = ["compact", "normal", "tall"];

const TOOLS: { id: TimelineTool; icon: ComponentType<SVGProps<SVGSVGElement>>; shortcut: string }[] = [
  { id: "select", icon: SelectToolIcon, shortcut: "A" },
  { id: "blade", icon: BladeToolIcon, shortcut: "B" },
  { id: "ripple", icon: RippleToolIcon, shortcut: "T" },
  { id: "roll", icon: RollToolIcon, shortcut: "T" },
  { id: "slip", icon: SlipToolIcon, shortcut: "Y" },
  { id: "slide", icon: SlideToolIcon, shortcut: "U" },
];

function ShortcutsHelp() {
  const t = useTranslations("studio.video.shortcuts");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("open")}
          title={t("open")}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[--radius] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Question className="h-4 w-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[70vh] w-96 overflow-y-auto p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">{t("title")}</p>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs">
          {SHORTCUT_ROWS.map((row) => (
            <div key={row.id} className="contents">
              <dt className="text-muted-foreground">{t(`rows.${row.id}`)}</dt>
              <dd className="text-right">
                <kbd className="rounded-[3px] border border-border-strong bg-muted px-1 font-sans text-2xs text-foreground">{row.keys}</kbd>
              </dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}

export function TimelineBar({ onAddTrack }: { onAddTrack: (kind: TrackKind) => void }) {
  const t = useTranslations("studio.video.timeline.bar");
  const { commands, view } = useVideoEditor();
  const playheadMs = useViewState((s) => s.playheadMs);
  const durationMs = useEditorState((s) => s.document.durationMs);
  const hasSelection = useEditorState((s) => s.selection.length > 0);
  const snapping = useViewState((s) => s.snapping);
  const magnetic = useViewState((s) => s.magnetic);
  const linkedSelection = useViewState((s) => s.linkedSelection);
  const trackHeight = useViewState((s) => s.trackHeight);
  const pxPerSecond = useViewState((s) => s.pxPerSecond);
  const dragMode = useViewState((s) => s.dragMode);
  const tool = useViewState((s) => s.tool);

  return (
    <div role="toolbar" aria-label={t("label")} className="flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border-strong bg-card px-2">
      <output aria-label={t("timecode")} className="mr-2 min-w-[11rem] font-mono text-sm font-semibold tabular-nums text-foreground">
        {formatSmpte(playheadMs)}
        <span className="text-xs font-normal text-muted-foreground"> / {formatSmpte(durationMs)}</span>
      </output>
      <div role="radiogroup" aria-label={t("tools")} className="flex items-center gap-0.5 rounded-[--radius] border border-border-strong bg-muted p-0.5">
        {TOOLS.map(({ id, icon: Icon, shortcut }) => (
          <ToolButton
            key={id}
            role="radio"
            aria-checked={tool === id}
            label={t(`toolNames.${id}`)}
            shortcut={shortcut}
            pressed={tool === id}
            icon={<Icon className="h-4 w-4" />}
            onClick={() => commands.setTool(id)}
          />
        ))}
      </div>
      <ToolDivider />
      <ToolButton label={t("snapping")} shortcut="N" icon={<Target className="h-4 w-4" />} pressed={snapping} onClick={commands.toggleSnapping} />
      <ToolButton label={t("magnetic")} icon={<Stack className="h-4 w-4" />} pressed={magnetic} onClick={commands.toggleMagnetic} />
      <ToolButton label={t("linkedSelection")} icon={<Link className="h-4 w-4" />} pressed={linkedSelection} onClick={commands.toggleLinkedSelection} />
      <ToolDivider />
      <ToolButton label={t("link")} icon={<Link className="h-4 w-4" />} disabled={!hasSelection} onClick={commands.link} />
      <ToolButton label={t("unlink")} icon={<LinkBreak className="h-4 w-4" />} disabled={!hasSelection} onClick={commands.unlink} />
      <ToolButton label={t("marker")} shortcut="M" icon={<FlagCheckered className="h-4 w-4" />} onClick={commands.addMarker} />
      <ToolDivider />
      <ToolButton label={t("addVisual")} icon={<VideoCamera className="h-4 w-4" />} onClick={() => onAddTrack("visual")} />
      <ToolButton label={t("addAudio")} icon={<Waveform className="h-4 w-4" />} onClick={() => onAddTrack("audio")} />
      <ElevatedPillToggle<TrackHeight>
        aria-label={t("trackHeight")}
        value={trackHeight}
        onChange={commands.setTrackHeight}
        options={HEIGHTS.map((height) => ({ value: height, label: t(`heights.${height}`) }))}
        className="ml-1"
      />
      {dragMode ? <DragModeBadge mode={dragMode} /> : null}
      <div className="ml-auto flex shrink-0 items-center gap-1 pl-2">
        <ToolButton label={t("zoomFit")} shortcut="Shift+Z" icon={<ArrowsInSimple className="h-3.5 w-3.5" />} onClick={commands.zoomToFit} />
        <ToolButton label={t("zoomOut")} shortcut="-" icon={<Minus className="h-3.5 w-3.5" />} onClick={() => commands.zoom(-1)} />
        <label className="flex items-center gap-1.5">
          <MagnifyingGlass className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <span className="sr-only">{t("zoom")}</span>
          <input
            type="range"
            min={0}
            max={1000}
            step={1}
            value={Math.round(zoomToSlider(pxPerSecond) * 1000)}
            onChange={(event) => view.setState({ pxPerSecond: sliderToZoom(Number(event.target.value) / 1000) })}
            onKeyDown={(event) => {
              if (RANGE_KEYS.has(event.key)) event.stopPropagation();
            }}
            aria-valuetext={t("zoomValue", { value: Math.round(pxPerSecond) })}
            className="h-1 w-24 cursor-pointer accent-primary"
          />
        </label>
        <ToolButton label={t("zoomIn")} shortcut="+" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => commands.zoom(1)} />
        <ShortcutsHelp />
      </div>
    </div>
  );
}

function DragModeBadge({ mode }: { mode: DragMode }) {
  const t = useTranslations("studio.video.timeline.bar.modes");
  return (
    <span role="status" className={cn("ml-2 rounded-[--radius] bg-foreground px-1.5 py-0.5 text-2xs font-semibold text-background")}>
      {t(mode)}
    </span>
  );
}
