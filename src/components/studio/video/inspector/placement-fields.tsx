"use client";

import { useTranslations } from "next-intl";

import { ArrowsDownUp, ArrowsLeftRight } from "@/components/icons";
import { ANCHOR_POINTS, anchorOf, type AnchorPoint } from "@/lib/studio/clip-placement";
import { ANCHOR_RANGE, type Anchor, type Clip } from "@/lib/studio/document";
import { sharedValue } from "@/lib/studio/selection-edit";
import { cn } from "@/lib/utils";

import { ToolButton } from "../tool-button";
import { FieldGrid, NumberField } from "./fields";
import type { SelectionEditor } from "./use-selection-editor";

interface PlacementFieldsProps {
  clips: readonly Clip[];
  disabled: boolean;
  editor: SelectionEditor;
}

const PERCENT = 100;

export function PlacementFields({ clips, disabled, editor }: PlacementFieldsProps) {
  const t = useTranslations("studio.video.inspector");
  const anchor = sharedValue(clips, (clip) => anchorOf(clip));
  const shared = anchor.kind === "same" ? anchor.value : null;
  const flippedX = clips.every((clip) => clip.flipX);
  const flippedY = clips.every((clip) => clip.flipY);
  const gesture = { onGestureStart: editor.gesture.onStart, onGestureEnd: editor.gesture.onCommit };
  const axisField = (axis: keyof Anchor) => ({
    unit: "%",
    decimals: 1,
    min: ANCHOR_RANGE[0] * PERCENT,
    max: ANCHOR_RANGE[1] * PERCENT,
    value: shared ? shared[axis] * PERCENT : null,
    disabled,
    onCommit: (value: number) => editor.anchor((current) => ({ ...current, [axis]: value / PERCENT }), true),
    onNudge: (delta: number) => editor.anchor((current) => ({ ...current, [axis]: current[axis] + delta / PERCENT }), true),
    ...gesture,
  });
  const at = (point: AnchorPoint) => shared !== null && shared.x === ANCHOR_POINTS[point].x && shared.y === ANCHOR_POINTS[point].y;

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div role="group" aria-label={t("anchorGrid")} className="grid shrink-0 grid-cols-3 gap-0.5 rounded-[--radius] border border-[hsl(var(--control-edge))] bg-card p-1">
          {(Object.keys(ANCHOR_POINTS) as AnchorPoint[]).map((point) => (
            <button
              key={point}
              type="button"
              aria-label={t(`anchorPoints.${point}`)}
              title={t(`anchorPoints.${point}`)}
              aria-pressed={at(point)}
              disabled={disabled}
              onClick={() => editor.anchor(() => ANCHOR_POINTS[point], true)}
              className="flex h-4 w-4 items-center justify-center rounded-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
            >
              <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", at(point) ? "bg-primary" : "bg-muted-foreground/50")} />
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <FieldGrid>
            <NumberField label={t("anchorX")} {...axisField("x")} />
            <NumberField label={t("anchorY")} {...axisField("y")} />
          </FieldGrid>
        </div>
      </div>
      <p className="text-2xs text-muted-foreground">{t("anchorHint")}</p>
      {clips.some((clip) => clip.type === "null") ? null : (
      <div className="flex items-center gap-1">
        <span className="mr-1 text-2xs text-muted-foreground">{t("flip")}</span>
        <ToolButton size="sm" label={t("flipX")} pressed={flippedX} disabled={disabled} icon={<ArrowsLeftRight className="h-3.5 w-3.5" />} onClick={() => editor.patch(() => ({ flipX: flippedX ? undefined : true }))} />
        <ToolButton size="sm" label={t("flipY")} pressed={flippedY} disabled={disabled} icon={<ArrowsDownUp className="h-3.5 w-3.5" />} onClick={() => editor.patch(() => ({ flipY: flippedY ? undefined : true }))} />
      </div>
      )}
    </div>
  );
}
