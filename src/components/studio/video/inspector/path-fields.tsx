"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import type { Clip } from "@/lib/studio/document";
import { axisScaled, keyAt, localTime, onPath } from "@/lib/studio/keyframe-edit";
import { pathFramesOf } from "@/lib/studio/keyframes";
import { curvePath, linkScale, scaleAxesMatch, setSpatialAt, splitScale, straightenPath, type MotionEdit, type ScaleAxis } from "@/lib/studio/motion-edit";
import { SPATIAL_MODES, spatialOf, type SpatialMode } from "@/lib/studio/path-keys";
import type { PatchBuilder } from "@/lib/studio/selection-edit";
import type { ClipPatch } from "@/lib/studio/timeline";

import { usePanelPlayhead } from "../editor-context";
import { SelectField, ToggleField } from "./fields";
import type { SelectionEditor } from "./use-selection-editor";

interface PathFieldsProps {
  clips: readonly Clip[];
  disabled: boolean;
  editor: SelectionEditor;
}

function patchOf(edit: MotionEdit): ClipPatch | null {
  return edit.ok ? edit.patch : null;
}

function common(clips: readonly Clip[], test: (clip: Clip) => boolean): boolean | null {
  const all = clips.every(test);
  return all || clips.every((clip) => !test(clip)) ? all : null;
}

export function PathFields({ clips, disabled, editor }: PathFieldsProps) {
  const t = useTranslations("studio.video.keyframes");
  const playheadMs = usePanelPlayhead();
  const [choosing, setChoosing] = useState(false);
  const split = common(clips, axisScaled);
  const curved = common(clips, onPath);
  const oriented = common(clips, (clip) => Boolean(clip.autoOrient));
  const movable = clips.some((clip) => onPath(clip) || (clip.keyframes?.x?.length ?? 0) > 0 || (clip.keyframes?.y?.length ?? 0) > 0);
  const single = clips.length === 1 ? clips[0] : null;
  const local = single ? localTime(single, playheadMs) : null;
  const pathKey = single && local !== null ? keyAt(pathFramesOf(single.keyframes), local) : null;

  const build = (edit: (clip: Clip) => MotionEdit): PatchBuilder => (clip) => patchOf(edit(clip));
  const linkTo = (keep: ScaleAxis) => {
    setChoosing(false);
    editor.patch(build((clip) => linkScale(clip, keep)));
  };

  return (
    <div className="space-y-2">
      <ToggleField
        label={t("scaleAxes.split")}
        checked={split}
        disabled={disabled}
        onChange={(next) => {
          if (next) {
            editor.patch((clip) => {
              const at = localTime(clip, editor.playheadMs());
              if (at === null && !(clip.keyframes?.scale?.length ?? 0)) return "keyframeOutside";
              return patchOf(splitScale(clip, at ?? 0));
            });
            return;
          }
          if (clips.every(scaleAxesMatch)) linkTo("x");
          else setChoosing(true);
        }}
      />
      {choosing ? (
        <div role="group" aria-label={t("scaleAxes.choose")} className="space-y-1.5 rounded-[--radius] border border-border p-2">
          <p className="text-2xs text-muted-foreground">{t("scaleAxes.choose")}</p>
          <div className="flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" title={t("scaleAxes.keepX")} onClick={() => linkTo("x")} />
            <Button variant="outline" size="sm" title={t("scaleAxes.keepY")} onClick={() => linkTo("y")} />
            <Button variant="ghost" size="sm" title={t("cancel")} onClick={() => setChoosing(false)} />
          </div>
        </div>
      ) : null}
      <ToggleField
        label={t("path.curve")}
        checked={curved}
        disabled={disabled || !movable}
        onChange={(next) => editor.patch(build((clip) => (next ? curvePath(clip, "auto") : straightenPath(clip, editor.aspect()))))}
      />
      <ToggleField
        label={t("path.orient")}
        checked={oriented}
        disabled={disabled || curved !== true}
        onChange={(next) => editor.patch(() => ({ autoOrient: next || undefined }))}
      />
      <p className="text-2xs text-muted-foreground">{curved === true ? t("path.orientHint") : t("path.curveHint")}</p>
      {single && pathKey ? (
        <SelectField<SpatialMode>
          label={t("path.spatialMenu")}
          value={spatialOf(pathKey)}
          disabled={disabled}
          options={SPATIAL_MODES.map((mode) => ({ value: mode, label: t(`path.spatial.${mode}`) }))}
          onChange={(mode) => editor.patch(build((clip) => setSpatialAt(clip, pathKey.atMs, mode, editor.aspect())))}
        />
      ) : null}
    </div>
  );
}
