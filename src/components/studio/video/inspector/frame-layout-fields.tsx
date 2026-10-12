"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { AlignGlyph } from "@/components/studio/canvas/align-glyph";
import { ALIGNMENTS, DISTRIBUTE_AXES } from "@/lib/studio/arrange";
import type { Clip } from "@/lib/studio/document";
import { hasFrame, type AlignTo } from "@/lib/studio/frame-layout";
import { ALIGN_SHORTCUTS, DISTRIBUTE_SHORTCUTS } from "@/lib/studio/video-shortcuts";

import { useVideoEditor } from "../editor-context";
import { ToolButton, ToolDivider } from "../tool-button";
import { InspectorSection } from "./fields";

const MIN_DISTRIBUTED = 3;

export function FrameLayoutFields({ clips, disabled }: { clips: readonly Clip[]; disabled: boolean }) {
  const t = useTranslations("studio.video.layout");
  const { commands } = useVideoEditor();
  const [relativeTo, setRelativeTo] = useState<AlignTo>("selection");
  const ids = clips.filter((clip) => hasFrame(clip.type)).map((clip) => clip.id);
  const several = ids.length > 1;

  return (
    <InspectorSection title={t("title")}>
      <div className="flex flex-wrap items-center gap-y-1">
        <div role="group" aria-label={t("alignGroup")} className="flex items-center gap-0.5">
          {ALIGNMENTS.map((alignment) => (
            <ToolButton
              key={alignment}
              size="sm"
              label={t(`align.${alignment}`)}
              shortcut={ALIGN_SHORTCUTS[alignment]}
              icon={<AlignGlyph kind={alignment} className="h-4 w-4" />}
              disabled={disabled}
              onClick={() => commands.alignClips(ids, alignment, several ? relativeTo : "frame")}
            />
          ))}
        </div>
        <ToolDivider />
        <div role="group" aria-label={t("distributeGroup")} className="flex items-center gap-0.5">
          {DISTRIBUTE_AXES.map((axis) => (
            <ToolButton
              key={axis}
              size="sm"
              label={t(`distribute.${axis}`)}
              shortcut={DISTRIBUTE_SHORTCUTS[axis]}
              icon={<AlignGlyph kind={axis} className="h-4 w-4" />}
              disabled={disabled || ids.length < MIN_DISTRIBUTED}
              onClick={() => commands.distributeClips(ids, axis)}
            />
          ))}
        </div>
      </div>
      {several ? (
        <div className="space-y-1">
          <span className="block text-2xs text-muted-foreground">{t("relativeTo")}</span>
          <ElevatedPillToggle<AlignTo>
            aria-label={t("relativeTo")}
            value={relativeTo}
            onChange={setRelativeTo}
            className="flex w-full [&>button]:flex-1"
            options={[
              { value: "selection", label: t("relative.selection"), disabled },
              { value: "frame", label: t("relative.frame"), disabled },
            ]}
          />
        </div>
      ) : null}
      <p className="text-2xs text-muted-foreground">{several ? t("hintSeveral") : t("hintOne")}</p>
    </InspectorSection>
  );
}
