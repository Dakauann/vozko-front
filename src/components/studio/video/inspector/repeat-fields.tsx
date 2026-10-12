"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { editFieldValue, fieldKeyState, toggleFieldKey } from "@/lib/studio/animated-fields";
import {
  CLIP_REPEAT_MODES,
  CLIP_REPEAT_PRESETS,
  CLIP_REPEAT_RANGES,
  CLIP_REPEAT_SPEC,
  clipRepeatFields,
  clipRepeatIssue,
  clipRepeatValue,
  defaultClipRepeat,
  presetClipRepeat,
  repeatCopies,
  REPEAT_ORDERS,
  type ClipRepeat,
  type ClipRepeatField,
  type ClipRepeatMode,
  type ClipRepeatPreset,
} from "@/lib/studio/clip-repeat";
import { videoCanvasSize, type Clip } from "@/lib/studio/document";
import { localTime } from "@/lib/studio/keyframe-edit";
import { REPEAT_DIRECTIONS, type RepeatBox } from "@/lib/studio/repeat";
import { cn } from "@/lib/utils";

import { useEditorState, usePanelPlayhead } from "../editor-context";
import { FieldGrid, InspectorSection, NumberField, SelectField, ToggleField } from "./fields";
import { KeyedField } from "./key-toggle";
import type { SelectionEditor } from "./use-selection-editor";

const PERCENT = 100;
const PERCENT_FIELDS: ReadonlySet<ClipRepeatField> = new Set(["scale", "startOpacity", "endOpacity"]);
const DEGREE_FIELDS: ReadonlySet<ClipRepeatField> = new Set(["rotation", "startAngle", "sweep", "angle"]);
const SAMPLE_BOX: RepeatBox = { left: 44, top: 44, right: 56, bottom: 56 };
const SAMPLE_SIDE = 100;

function scaleOf(field: ClipRepeatField): number {
  return PERCENT_FIELDS.has(field) ? PERCENT : 1;
}

function unitOf(field: ClipRepeatField): string | undefined {
  if (PERCENT_FIELDS.has(field)) return "%";
  if (DEGREE_FIELDS.has(field)) return "°";
  return field === "copies" || field === "shift" ? undefined : "px";
}

function PresetThumb({ preset }: { preset: ClipRepeatPreset }) {
  const copies = repeatCopies(presetClipRepeat(preset, SAMPLE_BOX), SAMPLE_BOX);
  return (
    <svg viewBox={`0 0 ${SAMPLE_SIDE} ${SAMPLE_SIDE}`} aria-hidden className="h-8 w-full rounded-sm border border-border bg-muted">
      {copies.map((copy) => {
        const { a, b, c, d, e, f } = copy.place;
        return <rect key={copy.index} x={44} y={44} width={12} height={12} rx={2} transform={`matrix(${a} ${b} ${c} ${d} ${e} ${f})`} opacity={Math.max(0.08, copy.opacity)} className="fill-foreground" />;
      })}
    </svg>
  );
}

interface RepeatFieldsProps {
  clip: Clip;
  disabled: boolean;
  editor: SelectionEditor;
}

export function RepeatFields({ clip, disabled, editor }: RepeatFieldsProps) {
  const t = useTranslations("studio.video.repeat");
  const canvas = useEditorState((s) => videoCanvasSize(s.document));
  const playheadMs = usePanelPlayhead();
  const localMs = localTime(clip, playheadMs);
  const repeat = clip.repeat;
  const boxOf = (current: Clip): RepeatBox => {
    const tr = current.transform;
    return { left: (tr.x - tr.w / 2) * canvas.width, top: (tr.y - tr.h / 2) * canvas.height, right: (tr.x + tr.w / 2) * canvas.width, bottom: (tr.y + tr.h / 2) * canvas.height };
  };
  const set = (build: (current: Clip) => ClipRepeat | undefined) =>
    editor.patch((current) => {
      const next = build(current);
      if (next && clipRepeatIssue(next)) return null;
      return { repeat: next };
    });

  if (!repeat) {
    return (
      <InspectorSection id="repeat" group="effects" title={t("title")}>
        <p className="text-2xs text-muted-foreground">{t("hint")}</p>
        <div role="group" aria-label={t("presetsTitle")} className="grid grid-cols-4 gap-1">
          {CLIP_REPEAT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              title={t("presetApply", { name: t(`presets.${preset}`) })}
              onClick={() => set((current) => presetClipRepeat(preset, boxOf(current)))}
              className={cn(
                "flex min-w-0 flex-col gap-1 rounded-[--radius] border border-border bg-card p-1 text-left text-[10px] leading-tight text-foreground transition-colors",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
              )}
            >
              <PresetThumb preset={preset} />
              <span className="line-clamp-2 block min-h-[2lh] break-words">{t(`presets.${preset}`)}</span>
            </button>
          ))}
        </div>
      </InspectorSection>
    );
  }

  const keyed = clipRepeatFields(repeat.mode);
  const change = (patch: Partial<ClipRepeat>) => set((current) => (current.repeat ? Object.fromEntries(Object.entries({ ...current.repeat, ...patch }).filter(([, value]) => value !== undefined)) as unknown as ClipRepeat : undefined));
  const numeric = (field: ClipRepeatField) => {
    const scale = scaleOf(field);
    const [min, max] = CLIP_REPEAT_RANGES[field];
    const state = fieldKeyState(repeat, field, localMs);
    const label = t(`fields.${field}`);
    return (
      <KeyedField
        key={field}
        toggle={{
          label: t("key", { field: label }),
          state,
          disabled: disabled || localMs === null,
          onClick: () => {
            if (localMs !== null) set((current) => (current.repeat ? toggleFieldKey(CLIP_REPEAT_SPEC, current.repeat, field, localMs) : undefined));
          },
        }}
      >
        <NumberField
          label={label}
          value={clipRepeatValue(repeat, field, localMs ?? 0) * scale}
          unit={unitOf(field)}
          decimals={field === "copies" ? 0 : 1}
          min={min * scale}
          max={Number.isFinite(max) ? max * scale : undefined}
          disabled={disabled}
          keyState={state}
          keyHint={state === "key" ? t("keyHint") : t("interpolatedHint")}
          onGestureStart={editor.gesture.onStart}
          onGestureEnd={editor.gesture.onCommit}
          onCommit={(value) => set((current) => (current.repeat ? (editFieldValue(CLIP_REPEAT_SPEC, current.repeat, field, value / scale, localMs) ?? current.repeat) : undefined))}
        />
      </KeyedField>
    );
  };

  return (
    <InspectorSection id="repeat" group="effects" title={t("title")} summary={t(`modes.${repeat.mode}`)}>
      <SelectField<ClipRepeatMode> label={t("mode")} value={repeat.mode} disabled={disabled} options={CLIP_REPEAT_MODES.map((mode) => ({ value: mode, label: t(`modes.${mode}`) }))} onChange={(mode) => set((current) => defaultClipRepeat(mode, boxOf(current)))} />
      {repeat.mode === "radial" ? (
        <FieldGrid>
          <NumberField label={t("fields.count")} value={repeat.count ?? 2} min={2} disabled={disabled} onCommit={(count) => change({ count: Math.round(count), shown: undefined })} />
          <SelectField label={t("fields.direction")} value={repeat.direction || "cw"} disabled={disabled} options={REPEAT_DIRECTIONS.map((direction) => ({ value: direction, label: t(`directions.${direction}`) }))} onChange={(direction) => change({ direction: direction === "cw" ? undefined : direction })} />
        </FieldGrid>
      ) : null}
      {repeat.mode === "radial" ? <ToggleField label={t("fields.upright")} checked={Boolean(repeat.upright)} disabled={disabled} onChange={(upright) => change({ upright: upright || undefined })} /> : null}
      {repeat.mode === "grid" ? (
        <FieldGrid>
          <NumberField label={t("fields.rows")} value={repeat.rows ?? 1} min={1} disabled={disabled} onCommit={(rows) => change({ rows: Math.round(rows) })} />
          <NumberField label={t("fields.columns")} value={repeat.columns ?? 1} min={1} disabled={disabled} onCommit={(columns) => change({ columns: Math.round(columns) })} />
        </FieldGrid>
      ) : null}
      <div className="grid grid-cols-2 gap-2">{keyed.map(numeric)}</div>
      <SelectField label={t("fields.order")} value={repeat.order || "above"} disabled={disabled} options={REPEAT_ORDERS.map((order) => ({ value: order, label: t(`orders.${order}`) }))} onChange={(order) => change({ order: order === "above" ? undefined : order })} />
      {localMs === null ? <p className="text-2xs text-muted-foreground">{t("outsideHint")}</p> : null}
      <Button variant="ghost" size="sm" title={t("remove")} disabled={disabled} onClick={() => set(() => undefined)} />
    </InspectorSection>
  );
}
