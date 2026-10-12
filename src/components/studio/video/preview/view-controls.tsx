"use client";

import { useTranslations } from "next-intl";

import { Minus, Plus } from "@/components/icons";
import { zoomPercent, ZoomMenuItems } from "@/components/studio/canvas/zoom-menu-items";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PREVIEW_QUALITIES, type PreviewQuality } from "@/lib/studio/preview-quality";
import { workArea } from "@/lib/studio/work-area";

import { useEditorState, useVideoEditor, useViewState } from "../editor-context";
import { LoopIcon, PlayRangeIcon, TransparencyGridIcon } from "../timeline/tool-icons";
import { ToolButton } from "../tool-button";

export const TRANSPORT_MENU_TRIGGER =
  "ml-2 inline-flex h-7 min-w-10 items-center justify-center rounded-[--radius] px-1.5 font-mono text-xs tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted data-[state=open]:text-foreground";

export function WorkAreaPlayback() {
  const t = useTranslations("studio.video.transport");
  const { commands } = useVideoEditor();
  const loop = useViewState((s) => s.loop);
  const durationMs = useEditorState((s) => s.document.durationMs);
  const hasArea = useViewState((s) => workArea(s.range, durationMs) !== null);

  return (
    <>
      <ToolButton label={t("playRange")} shortcut="Ctrl+Shift+Space" icon={<PlayRangeIcon className="h-4 w-4" />} disabled={!hasArea} onClick={commands.playRange} />
      <ToolButton label={t("loop")} shortcut="Shift+L" icon={<LoopIcon className="h-4 w-4" />} pressed={loop} onClick={commands.toggleLoop} />
    </>
  );
}

export function PreviewQualityMenu() {
  const t = useTranslations("studio.video.transport");
  const { commands } = useVideoEditor();
  const quality = useViewState((s) => s.previewQuality);
  const blurWhileScrubbing = useViewState((s) => s.blurWhileScrubbing);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={t("quality", { quality: t(`qualities.${quality}`) })} className={TRANSPORT_MENU_TRIGGER}>
          {t(`qualityShort.${quality}`)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-2xs font-normal text-muted-foreground">{t("qualityHint")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={quality} onValueChange={(value) => commands.setPreviewQuality(value as PreviewQuality)}>
          {PREVIEW_QUALITIES.map((option) => (
            <DropdownMenuRadioItem key={option} value={option} className="text-xs">
              {t(`qualities.${option}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={blurWhileScrubbing} onCheckedChange={commands.toggleBlurWhileScrubbing} className="text-xs">
          {t("blurWhileScrubbing")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuLabel className="text-2xs font-normal text-muted-foreground">{t("blurWhileScrubbingHint")}</DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TransparencyGridToggle() {
  const t = useTranslations("studio.video.transport");
  const { commands } = useVideoEditor();
  const grid = useViewState((s) => s.transparencyGrid);
  return <ToolButton label={t("transparencyGrid")} icon={<TransparencyGridIcon className="h-4 w-4" />} pressed={grid} onClick={commands.toggleTransparencyGrid} />;
}

export function PreviewZoomControls() {
  const t = useTranslations("studio.video.transport");
  const { commands } = useVideoEditor();
  const scale = useViewState((s) => s.previewViewport.scale);
  const fit = useViewState((s) => s.previewFit);

  return (
    <div role="group" aria-label={t("zoom")} className="ml-1 flex items-center">
      <ToolButton label={t("zoomOut")} shortcut="Ctrl+-" icon={<Minus className="h-3.5 w-3.5" />} onClick={() => commands.stepPreviewZoom(-1)} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={t("zoomLevel", { percent: Math.round(scale * 100) })} className={TRANSPORT_MENU_TRIGGER}>
            {fit ? t("fit") : zoomPercent(scale)}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <ZoomMenuItems fit={fit} fitLabel={t("fit")} onFit={commands.fitPreview} onZoom={commands.zoomPreview} />
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolButton label={t("zoomIn")} shortcut="Ctrl+=" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => commands.stepPreviewZoom(1)} />
    </div>
  );
}
