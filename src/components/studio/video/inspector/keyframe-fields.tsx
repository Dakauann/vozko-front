"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { CaretLeft, CaretRight, Timer } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Clip } from "@/lib/studio/document";
import { adjacentKey, framesOf, isAnimated, keyAt, localTime, propertyEasing, propertyValue, setPropertyEasing, toggleAnimation, toggleKeyAt } from "@/lib/studio/keyframe-edit";
import { KEYFRAME_PROPERTIES, type KeyframeProperty } from "@/lib/studio/keyframes";
import { cn } from "@/lib/utils";

import { usePanelPlayhead, useVideoEditor, useViewState } from "../editor-context";
import { ToolButton } from "../tool-button";
import { EasingPicker } from "./easing-picker";

export function KeyDiamond({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden className={cn("h-2.5 w-2.5", className)}>
      <path d="M5 0.8 9.2 5 5 9.2 0.8 5Z" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function formatValue(property: KeyframeProperty, value: number): string {
  if (property === "rotation") return `${value.toFixed(1)}°`;
  return `${(value * 100).toFixed(1)}%`;
}

export interface PropertyKeyListProps {
  clip: Clip;
  disabled: boolean;
}

export function PropertyKeyList({ clip, disabled }: PropertyKeyListProps) {
  const t = useTranslations("studio.video.keyframes");
  const { commands, view, playback } = useVideoEditor();
  const playheadMs = usePanelPlayhead();
  const keyProperty = useViewState((s) => s.keyProperty);
  const [stopping, setStopping] = useState<KeyframeProperty | null>(null);
  const local = localTime(clip, playheadMs);
  const sample = local ?? Math.min(Math.max(0, playheadMs - clip.startMs), clip.durationMs);
  const easing = propertyEasing(clip, keyProperty, local);
  const keyName = t(`properties.${keyProperty}`);

  const seekLocal = (atMs: number) => playback.seek(clip.startMs + atMs);

  return (
    <>
      <ul className="space-y-0.5" aria-label={t("advanced")}>
        {KEYFRAME_PROPERTIES.map((property) => {
          const animated = isAnimated(clip, property);
          const frames = framesOf(clip, property);
          const times = frames.map((f) => f.atMs);
          const onKey = local !== null && keyAt(frames, local) !== null;
          const name = t(`properties.${property}`);
          return (
            <li
              key={property}
              className={cn("flex items-center gap-1 rounded-[--radius] px-1 py-0.5", keyProperty === property ? "bg-muted" : undefined)}
              onPointerDown={() => view.setState({ keyProperty: property })}
              onFocusCapture={() => view.setState({ keyProperty: property })}
            >
              <ToolButton
                size="sm"
                label={animated ? t("stopAnimating", { name }) : t("animate", { name })}
                pressed={animated}
                disabled={disabled}
                icon={<Timer className="h-3.5 w-3.5" />}
                onClick={() => {
                  if (animated) setStopping(property);
                  else commands.patchKeyframes(clip.id, (current, at) => toggleAnimation(current, property, at));
                }}
              />
              <span className="min-w-0 flex-1 truncate text-xs text-foreground">{name}</span>
              <span className={cn("w-14 text-right text-2xs tabular-nums text-muted-foreground", animated && !onKey && "italic")}>{formatValue(property, propertyValue(clip, property, sample))}</span>
              <ToolButton
                size="sm"
                label={t("previous", { name })}
                disabled={!animated || adjacentKey(times, sample, -1) === null}
                icon={<CaretLeft className="h-3 w-3" />}
                onClick={() => {
                  const at = adjacentKey(times, sample, -1);
                  if (at !== null) seekLocal(at);
                }}
              />
              <ToolButton
                size="sm"
                label={onKey ? t("removeKey", { name }) : t("addKey", { name })}
                disabled={disabled || !animated || local === null}
                icon={<KeyDiamond filled={onKey} className={onKey ? "text-primary-ink" : undefined} />}
                onClick={() => commands.patchKeyframes(clip.id, (current, at) => toggleKeyAt(current, property, at))}
              />
              <ToolButton
                size="sm"
                label={t("next", { name })}
                disabled={!animated || adjacentKey(times, sample, 1) === null}
                icon={<CaretRight className="h-3 w-3" />}
                onClick={() => {
                  const at = adjacentKey(times, sample, 1);
                  if (at !== null) seekLocal(at);
                }}
              />
            </li>
          );
        })}
      </ul>
      <EasingPicker
        label={easing.scope === "key" ? t("easing", { name: keyName }) : t("easingProperty", { name: keyName })}
        value={easing.easing}
        disabled={disabled || !isAnimated(clip, keyProperty)}
        onPick={(next) => commands.patchKeyframes(clip.id, (current) => setPropertyEasing(current, keyProperty, local, next), true)}
      />
      <ConfirmDialog
        open={stopping !== null}
        onOpenChange={(open) => {
          if (!open) setStopping(null);
        }}
        title={t("confirmTitle", { name: stopping ? t(`properties.${stopping}`) : "" })}
        description={t("confirmDescription")}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        onConfirm={() => {
          const property = stopping;
          setStopping(null);
          if (property) commands.patchKeyframes(clip.id, (current, at) => toggleAnimation(current, property, at), true);
        }}
      />
    </>
  );
}
