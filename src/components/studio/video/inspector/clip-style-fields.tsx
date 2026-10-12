"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { EffectsSection } from "@/components/studio/image/inspector/effects-list";
import { FillsSection, StrokesSection } from "@/components/studio/image/inspector/paint-lists";
import { MEDIA_EFFECT_TYPES } from "@/lib/studio/clip-style";
import { setClipStyle, silhouetteLayer, styleOwner, styleSelectionEdit, toggleClipEffectKey, type StyleLists } from "@/lib/studio/clip-style-edit";
import type { Clip } from "@/lib/studio/document";
import { editedEffect, effectKeyState, shownEffect, type EffectProperty } from "@/lib/studio/effect-keys";
import { localTime } from "@/lib/studio/keyframe-edit";
import { takesFills, takesStrokes, type Effect } from "@/lib/studio/layer-paint";
import type { LayerPatch } from "@/lib/studio/layers";

import { LiveEditContext } from "../../inspector/live-edit";
import { usePanelPlayhead } from "../editor-context";
import { KeyToggle } from "./key-toggle";
import { reportSelection } from "./selection-notice";
import type { SelectionEditor } from "./use-selection-editor";

interface ClipStyleFieldsProps {
  clip: Clip;
  disabled: boolean;
  editor: SelectionEditor;
}

function listsOf(patch: LayerPatch): StyleLists {
  return {
    ...("fills" in patch ? { fills: patch.fills ?? [] } : {}),
    ...("strokes" in patch ? { strokes: patch.strokes ?? [] } : {}),
    ...("effects" in patch ? { effects: patch.effects ?? [] } : {}),
  };
}

export function ClipStyleFields({ clip, disabled, editor }: ClipStyleFieldsProps) {
  const t = useTranslations("studio.video.styles");
  const playheadMs = usePanelPlayhead();
  const live = useMemo(() => ({ start: editor.gesture.onStart, end: editor.gesture.onCommit }), [editor]);
  const owner = styleOwner(clip);
  if (!owner) return null;
  const localMs = localTime(clip, playheadMs);
  const layer = owner === "layer" ? clip.layer! : silhouetteLayer(clip);
  const onPatch = (patch: LayerPatch) => editor.run((doc) => styleSelectionEdit(setClipStyle(doc, clip.id, listsOf(patch))));
  const fieldKey = (effect: Effect, property: EffectProperty) => (
    <KeyToggle
      label={t("key", { field: t(`properties.${property}`) })}
      state={effectKeyState(effect, property, localMs)}
      disabled={disabled || localMs === null}
      onClick={() => {
        if (localMs !== null) editor.run((doc) => styleSelectionEdit(toggleClipEffectKey(doc, clip.id, effect.id, property, localMs)));
      }}
    />
  );
  return (
    <LiveEditContext.Provider value={live}>
      {owner === "layer" && takesFills(layer) ? <FillsSection layer={layer} disabled={disabled} onPatch={onPatch} /> : null}
      {owner === "clip" || takesStrokes(layer) ? <StrokesSection layer={layer} disabled={disabled} onPatch={onPatch} /> : null}
      <EffectsSection
        layer={layer}
        disabled={disabled}
        onPatch={onPatch}
        types={owner === "clip" ? MEDIA_EFFECT_TYPES : undefined}
        shown={(effect) => shownEffect(effect, localMs ?? 0)}
        edit={(stored, shown, next) => {
          const result = editedEffect(stored, shown, next, localMs);
          if (!result) reportSelection("keyframeOutside");
          return result;
        }}
        fieldKey={fieldKey}
      />
      <p className="px-3 pb-2 text-2xs text-muted-foreground">{owner === "clip" ? t("mediaHint") : t("overlayHint")}</p>
    </LiveEditContext.Provider>
  );
}
