"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { CaretDown, CaretUp, Eye, EyeSlash, Plus, Trash } from "@/components/icons";
import type { Layer } from "@/lib/studio/document";
import { startGradient } from "@/lib/studio/layer-effects";
import { LAYER_RANGES } from "@/lib/studio/layer-ranges";
import { PAINT_TYPES, STROKE_ALIGNS, strokeLook, tracesOutline, withStrokeLook, type Paint, type PaintType, type StrokeAlign, type StrokePaint } from "@/lib/studio/layer-paint";
import type { LayerPatch } from "@/lib/studio/layers";
import { addedFill, addedStroke, fillsPatch, moved, NEW_FILL_COLOR, removed, replaced, strokesPatch } from "@/lib/studio/paint-edits";
import { DEFAULT_PATTERN } from "@/lib/studio/pattern";

import { ColorField, IconButton, InspectorSection, NumberField, SelectField } from "../controls";
import { GradientFields, StrokeStyleFields } from "./effects";
import { BlendField, OpacityField, PatternFields } from "./pattern-fields";

interface ListProps {
  layer: Layer;
  disabled: boolean;
  onPatch: (patch: LayerPatch) => void;
}

export interface ListRowProps {
  title: string;
  hidden: boolean;
  disabled: boolean;
  first: boolean;
  last: boolean;
  onHidden: (hidden: boolean) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
  children: ReactNode;
}

export function ListRow({ title, hidden, disabled, first, last, onHidden, onMove, onRemove, children }: ListRowProps) {
  const t = useTranslations("studio.image.paint");
  return (
    <div role="group" aria-label={title} className="space-y-2 rounded-md border border-border p-2">
      <div className="flex items-center gap-1">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{title}</span>
        <IconButton label={hidden ? t("show") : t("hide")} disabled={disabled} onClick={() => onHidden(!hidden)}>
          {hidden ? <EyeSlash className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
        </IconButton>
        <IconButton label={t("moveUp")} disabled={disabled || first} onClick={() => onMove(1)}>
          <CaretUp className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
        <IconButton label={t("moveDown")} disabled={disabled || last} onClick={() => onMove(-1)}>
          <CaretDown className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
        <IconButton label={t("remove")} disabled={disabled} onClick={onRemove}>
          <Trash className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
      </div>
      {hidden ? null : children}
    </div>
  );
}

function retyped<P extends Paint>(paint: P, type: PaintType): P {
  const color = paint.type === "solid" ? paint.color : paint.type === "gradient" ? paint.gradient?.from : undefined;
  const base = { ...paint, type, color: undefined, gradient: undefined, pattern: undefined };
  if (type === "solid") return { ...base, color: color || NEW_FILL_COLOR };
  if (type === "gradient") return { ...base, gradient: startGradient(color) };
  return { ...base, pattern: DEFAULT_PATTERN };
}

function PaintFields<P extends Paint>({ paint, disabled, types, onChange }: { paint: P; disabled: boolean; types: readonly PaintType[]; onChange: (paint: P) => void }) {
  const t = useTranslations("studio.image.paint.fills");
  return (
    <>
      {types.length > 1 ? <SelectField<PaintType> label={t("type")} value={paint.type} options={types.map((type) => ({ value: type, label: t(`types.${type}`) }))} disabled={disabled} onChange={(type) => onChange(retyped(paint, type))} /> : null}
      {paint.type === "solid" ? <ColorField label={t("color")} value={paint.color ?? ""} disabled={disabled} onCommit={(color) => onChange({ ...paint, color })} /> : null}
      {paint.type === "gradient" ? (
        <GradientFields gradient={paint.gradient} fallback={NEW_FILL_COLOR} disabled={disabled} onChange={(gradient) => onChange(gradient ? { ...paint, gradient } : retyped(paint, "solid"))} />
      ) : null}
      {paint.type === "pattern" && paint.pattern ? <PatternFields pattern={paint.pattern} disabled={disabled} withMix={false} onChange={(pattern) => onChange({ ...paint, pattern })} /> : null}
    </>
  );
}

function displayOrder<T>(list: readonly T[]): { item: T; index: number }[] {
  return list.map((item, index) => ({ item, index })).reverse();
}

export function FillsSection({ layer, disabled, onPatch }: ListProps) {
  const t = useTranslations("studio.image.paint.fills");
  const fills = layer.fills ?? [];
  const set = (next: readonly Paint[]) => onPatch(fillsPatch(next));
  return (
    <InspectorSection
      title={t("title")}
      action={
        <IconButton label={t("add")} disabled={disabled} onClick={() => onPatch(addedFill(layer))}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
      }
    >
      {displayOrder(fills).map(({ item, index }) => (
        <ListRow
          key={index}
          title={t("row", { number: index + 1 })}
          hidden={Boolean(item.hidden)}
          disabled={disabled}
          first={index === fills.length - 1}
          last={index === 0}
          onHidden={(hidden) => set(replaced(fills, index, { ...item, hidden: hidden || undefined }))}
          onMove={(delta) => set(moved(fills, index, delta))}
          onRemove={() => set(removed(fills, index))}
        >
          <PaintFields paint={item} disabled={disabled} types={PAINT_TYPES} onChange={(paint) => set(replaced(fills, index, paint))} />
          <OpacityField value={item.opacity} disabled={disabled} onChange={(opacity) => set(replaced(fills, index, { ...item, opacity }))} />
          <BlendField value={item.blendMode} disabled={disabled} onChange={(blendMode) => set(replaced(fills, index, { ...item, blendMode }))} />
        </ListRow>
      ))}
    </InspectorSection>
  );
}

function StrokeFields({ layer, stroke, traced, disabled, onChange }: { layer: Layer; stroke: StrokePaint; traced: boolean; disabled: boolean; onChange: (stroke: StrokePaint) => void }) {
  const t = useTranslations("studio.image.paint.strokes");
  return (
    <>
      <PaintFields paint={stroke} disabled={disabled} types={traced ? ["solid"] : PAINT_TYPES} onChange={onChange} />
      <NumberField label={t("width")} value={stroke.width} min={LAYER_RANGES.strokeWidth[0]} max={LAYER_RANGES.strokeWidth[1]} step={0.5} decimals={1} suffix="px" disabled={disabled} onCommit={(width) => onChange({ ...stroke, width })} />
      {traced ? (
        <p className="text-2xs text-muted-foreground">{t("traced")}</p>
      ) : (
        <>
          <SelectField<StrokeAlign> label={t("align")} value={stroke.align} options={STROKE_ALIGNS.map((align) => ({ value: align, label: t(`aligns.${align}`) }))} disabled={disabled} onChange={(align) => onChange({ ...stroke, align })} />
          <StrokeStyleFields layer={strokeLook(layer, stroke)} disabled={disabled} onPatch={(patch) => onChange(withStrokeLook(stroke, patch))} />
        </>
      )}
      <OpacityField value={stroke.opacity} disabled={disabled} onChange={(opacity) => onChange({ ...stroke, opacity })} />
      {traced ? null : <BlendField value={stroke.blendMode} disabled={disabled} onChange={(blendMode) => onChange({ ...stroke, blendMode })} />}
    </>
  );
}

export function StrokesSection({ layer, disabled, onPatch }: ListProps) {
  const t = useTranslations("studio.image.paint.strokes");
  const strokes = layer.strokes ?? [];
  const traced = tracesOutline(layer);
  const set = (next: readonly StrokePaint[]) => onPatch(strokesPatch(next));
  return (
    <InspectorSection
      title={t("title")}
      action={
        <IconButton label={t("add")} disabled={disabled} onClick={() => onPatch(addedStroke(layer))}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
      }
    >
      {displayOrder(strokes).map(({ item, index }) => (
        <ListRow
          key={index}
          title={t("row", { number: index + 1 })}
          hidden={Boolean(item.hidden)}
          disabled={disabled}
          first={index === strokes.length - 1}
          last={index === 0}
          onHidden={(hidden) => set(replaced(strokes, index, { ...item, hidden: hidden || undefined }))}
          onMove={(delta) => set(moved(strokes, index, delta))}
          onRemove={() => set(removed(strokes, index))}
        >
          <StrokeFields layer={layer} stroke={item} traced={traced} disabled={disabled} onChange={(stroke) => set(replaced(strokes, index, stroke))} />
        </ListRow>
      ))}
    </InspectorSection>
  );
}
