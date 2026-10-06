"use client";

import { useTranslations } from "next-intl";

import { Eye, MagnifyingGlass, X } from "@/components/icons";
import type { Clip } from "@/lib/studio/document";

import { CLIP_GLYPH, CLIP_TILE } from "../clip-tones";
import { useVideoEditor, useViewState } from "../editor-context";
import { ToolButton } from "../tool-button";

export function clipName(clip: Clip, fallback: string): string {
  if (clip.layer?.type === "text" && clip.layer.text) return clip.layer.text;
  return fallback;
}

export function FocusStrip({ clip }: { clip: Clip }) {
  const t = useTranslations("studio.video.focus");
  const tc = useTranslations("studio.video.timeline.clipTypes");
  const { commands } = useVideoEditor();
  const focus = useViewState((s) => s.focus);
  const Glyph = CLIP_GLYPH[clip.type];
  const name = clipName(clip, tc(clip.type));

  return (
    <div role="region" aria-label={t("label")} className="flex h-8 shrink-0 items-center gap-2 border-b border-border-strong bg-card px-2">
      <span className={`${CLIP_TILE[clip.type]} flex h-4 w-4 shrink-0 items-center justify-center`} aria-hidden>
        <Glyph className="h-2.5 w-2.5" />
      </span>
      <span className="min-w-0 truncate text-xs font-semibold text-foreground">{t("title", { name })}</span>
      <div className="ml-auto flex items-center gap-1">
        <ToolButton label={t("solo")} icon={<Eye className="h-3.5 w-3.5" />} showLabel pressed={Boolean(focus?.solo)} onClick={() => commands.toggleFocusOption("solo")} />
        <ToolButton label={t("zoom")} icon={<MagnifyingGlass className="h-3.5 w-3.5" />} showLabel pressed={Boolean(focus?.zoom)} onClick={() => commands.toggleFocusOption("zoom")} />
        <ToolButton label={t("leave")} shortcut="Esc" icon={<X className="h-3.5 w-3.5" />} showLabel onClick={commands.leaveFocus} />
      </div>
    </div>
  );
}
