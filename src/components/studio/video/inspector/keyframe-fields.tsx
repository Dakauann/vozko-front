"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { CaretLeft, CaretRight, Timer } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Clip } from "@/lib/studio/document";
import { adjacentKey, isAnimated, keyAt, keyTimesFor, laneProperties, localTime, propertyEasing, setPropertyEasing, toggleAnimation, toggleKeyAt } from "@/lib/studio/keyframe-edit";
import type { AnimatedProperty } from "@/lib/studio/keyframes";
import { cn } from "@/lib/utils";

import { usePanelPlayhead, useVideoEditor, useViewState } from "../editor-context";
import { KeyDiamond } from "../key-diamond";
import { PropertyReadout } from "../property-readout";
import { ToolButton } from "../tool-button";
import { EasingPicker } from "./easing-picker";

export interface PropertyKeyListProps {
  clip: Clip;
  disabled: boolean;
}

export function PropertyKeyList({ clip, disabled }: PropertyKeyListProps) {
  const t = useTranslations("studio.video.keyframes");
  const { commands, view, playback } = useVideoEditor();
  const playheadMs = usePanelPlayhead();
  const keyProperty = useViewState((s) => s.keyProperty);
  const [stopping, setStopping] = useState<AnimatedProperty | null>(null);
  const local = localTime(clip, playheadMs);
  const sample = local ?? Math.min(Math.max(0, playheadMs - clip.startMs), clip.durationMs);
  const easing = propertyEasing(clip, keyProperty, local);
  const keyName = t(`properties.${keyProperty}`);

  const seekLocal = (atMs: number) => playback.seek(clip.startMs + atMs);

  return (
    <>
      <ul className="space-y-0.5" aria-label={t("advanced")}>
        {laneProperties(clip).map((property) => {
          const animated = isAnimated(clip, property);
          const times = keyTimesFor(clip, property);
          const onKey = local !== null && keyAt(times.map((atMs) => ({ atMs })), local) !== null;
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
                  else commands.patchKeyframes(clip.id, (current, at, aspect) => toggleAnimation(current, property, at, aspect));
                }}
              />
              <span className="min-w-0 flex-1 truncate text-xs text-foreground">{name}</span>
              <PropertyReadout clip={clip} property={property} localMs={sample} className={cn("w-20 text-right text-2xs text-muted-foreground", animated && !onKey && "italic")} />
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
                onClick={() => commands.patchKeyframes(clip.id, (current, at, aspect) => toggleKeyAt(current, property, at, aspect))}
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
          if (property) commands.patchKeyframes(clip.id, (current, at, aspect) => toggleAnimation(current, property, at, aspect), true);
        }}
      />
    </>
  );
}
