"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { videoCanvasSize, type Clip } from "@/lib/studio/document";
import { keyState, localTime, toggleKeyAt } from "@/lib/studio/keyframe-edit";
import { newTextPath, pathOffsetAt, reshapedTextPath, TEXT_PATH_ALIGNS, TEXT_PATH_BEND_RANGE, TEXT_PATH_SHAPES, textPathPatch, usesBend, type TextPath } from "@/lib/studio/text-path";
import { PATH_OFFSET_RANGE } from "@/lib/studio/text-properties";

import { useEditorState, usePanelPlayhead, useVideoEditor } from "../editor-context";
import { CodeField } from "./code-field";
import { FieldGrid, InspectorSection, NumberField, SelectField, SliderField, ToggleField } from "./fields";
import { KeyedField } from "./key-toggle";
import type { SelectionEditor } from "./use-selection-editor";

const PERCENT = 100;

interface TextPathFieldsProps {
  clip: Clip;
  disabled: boolean;
  editor: SelectionEditor;
}

export function TextPathFields({ clip, disabled, editor }: TextPathFieldsProps) {
  const t = useTranslations("studio.video.textPath");
  const { commands } = useVideoEditor();
  const canvas = useEditorState((s) => videoCanvasSize(s.document));
  const playheadMs = usePanelPlayhead();
  const localMs = localTime(clip, playheadMs);
  const sample = localMs ?? Math.min(Math.max(0, playheadMs - clip.startMs), clip.durationMs);
  const path = clip.textPath;

  if (!path) {
    return (
      <InspectorSection title={t("title")}>
        <Button variant="outline" size="sm" title={t("add")} disabled={disabled} onClick={() => editor.patch((current) => textPathPatch(current, newTextPath("arc", current.layer)))} />
        <p className="text-2xs text-muted-foreground">{t("hint")}</p>
      </InspectorSection>
    );
  }

  const change = (build: (current: TextPath, clip: Clip) => TextPath) => editor.patch((current) => (current.textPath ? textPathPatch(current, build(current.textPath, current)) : null));
  const box = (current: Clip) => ({ width: current.transform.w * canvas.width, height: current.transform.h * canvas.height });
  const state = keyState(clip, "pathOffset", localMs);
  const bend = path.bend ?? 0;

  return (
    <InspectorSection title={t("title")}>
      <SelectField label={t("shape")} value={path.shape} disabled={disabled} options={TEXT_PATH_SHAPES.map((value) => ({ value, label: t(`shapes.${value}`) }))} onChange={(shape) => change((current, owner) => reshapedTextPath(current, shape, box(owner)))} />
      {usesBend(path.shape) ? (
        <SliderField
          label={t("bend")}
          min={TEXT_PATH_BEND_RANGE[0] * PERCENT}
          max={TEXT_PATH_BEND_RANGE[1] * PERCENT}
          step={1}
          value={Math.round(bend * PERCENT)}
          fallback={0}
          valueText={`${Math.round(bend * PERCENT)}`}
          disabled={disabled}
          onChange={(value) => change((current) => ({ ...current, bend: value / PERCENT }))}
          onStart={editor.gesture.onStart}
          onCommit={editor.gesture.onCommit}
        />
      ) : null}
      {path.shape === "custom" ? <CodeField label={t("path")} hint={t("pathHint")} value={path.path ?? ""} disabled={disabled} onCommit={(data) => change((current) => ({ ...current, path: data }))} /> : null}
      <KeyedField toggle={{ label: t("key"), state, disabled: disabled || localMs === null, onClick: () => commands.patchKeyframes(clip.id, (current, at, aspect) => toggleKeyAt(current, "pathOffset", at, aspect)) }}>
        <NumberField
          label={t("offset")}
          unit="%"
          decimals={1}
          step={1}
          min={PATH_OFFSET_RANGE[0] * PERCENT}
          max={PATH_OFFSET_RANGE[1] * PERCENT}
          value={pathOffsetAt(clip, sample) * PERCENT}
          disabled={disabled}
          keyState={state}
          keyHint={state === "key" ? t("keyHint") : t("interpolatedHint")}
          onCommit={(value) => editor.keyed("pathOffset", () => value / PERCENT)}
          onNudge={(delta) => editor.keyed("pathOffset", (shown) => shown + delta / PERCENT)}
          onGestureStart={editor.gesture.onStart}
          onGestureEnd={editor.gesture.onCommit}
        />
      </KeyedField>
      <FieldGrid>
        <SelectField label={t("align")} value={path.align} disabled={disabled} options={TEXT_PATH_ALIGNS.map((value) => ({ value, label: t(`aligns.${value}`) }))} onChange={(align) => change((current) => ({ ...current, align }))} />
      </FieldGrid>
      <ToggleField label={t("upright")} checked={Boolean(path.upright)} disabled={disabled} onChange={(upright) => change((current) => ({ ...current, upright: upright || undefined }))} />
      <ToggleField label={t("reverse")} checked={Boolean(path.reverse)} disabled={disabled} onChange={(reverse) => change((current) => ({ ...current, reverse: reverse || undefined }))} />
      <p className="text-2xs text-muted-foreground">{t("slideHint")}</p>
      <Button variant="ghost" size="sm" title={t("remove")} disabled={disabled} onClick={() => editor.patch((current) => textPathPatch(current, null))} />
    </InspectorSection>
  );
}
