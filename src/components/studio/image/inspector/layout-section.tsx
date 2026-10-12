"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Kanban, Trash } from "@/components/icons";
import { ITEM_SIZINGS, LAYOUT_ALIGNS, LAYOUT_SIZINGS, LAYOUT_SPACING_RANGE, type ItemSizing, type Layout, type LayoutItem, type LayoutPadding } from "@/lib/studio/auto-layout";
import { scaffoldFor, type LayoutRefusal } from "@/lib/studio/auto-layout-edits";
import type { Artboard, Layer, StudioGroup } from "@/lib/studio/document";

import { IconButton, InspectorSection, Notice, NumberField, OUTLINE_BUTTON_CLASS, SelectField, SwitchRow } from "../controls";
import { useImageEditor } from "../editor-state";

const ZERO: LayoutPadding = { top: 0, right: 0, bottom: 0, left: 0 };
const SIDES = ["top", "right", "bottom", "left"] as const;

function LayoutFields({ group, disabled, onRefused }: { group: StudioGroup; disabled: boolean; onRefused: (reason: LayoutRefusal | null) => void }) {
  const t = useTranslations("studio.image.layout");
  const { commands } = useImageEditor();
  const layout = group.layout!;
  const padding = layout.padding ?? ZERO;
  const change = (patch: Partial<Layout>) => onRefused(commands.setLayout({ groupId: group.id }, patch));
  return (
    <div className="space-y-2">
      <SelectField label={t("direction")} value={layout.direction} disabled={disabled} options={(["horizontal", "vertical"] as const).map((value) => ({ value, label: t(`directions.${value}`) }))} onChange={(direction) => change({ direction })} />
      <SwitchRow label={t("autoGap")} checked={Boolean(layout.autoGap)} disabled={disabled} onChange={(autoGap) => change({ autoGap, ...(autoGap ? { gap: undefined, alignMain: undefined } : {}) })} />
      {layout.autoGap ? null : <NumberField label={t("gap")} value={layout.gap ?? 0} min={LAYOUT_SPACING_RANGE[0]} max={LAYOUT_SPACING_RANGE[1]} suffix="px" disabled={disabled} onCommit={(gap) => change({ gap })} />}
      <fieldset className="grid grid-cols-4 gap-1.5" disabled={disabled}>
        <legend className="mb-1 text-2xs text-muted-foreground">{t("padding")}</legend>
        {SIDES.map((side) => (
          <NumberField key={side} label={t(`sides.${side}`)} short={t(`sidesShort.${side}`)} value={padding[side]} min={LAYOUT_SPACING_RANGE[0]} max={LAYOUT_SPACING_RANGE[1]} disabled={disabled} onCommit={(value) => change({ padding: { ...padding, [side]: value } })} />
        ))}
      </fieldset>
      {layout.autoGap ? null : <SelectField label={t("alignMain")} value={layout.alignMain ?? "start"} disabled={disabled} options={LAYOUT_ALIGNS.map((value) => ({ value, label: t(`aligns.${value}`) }))} onChange={(alignMain) => change({ alignMain })} />}
      <SelectField label={t("alignCross")} value={layout.alignCross ?? "start"} disabled={disabled} options={LAYOUT_ALIGNS.map((value) => ({ value, label: t(`aligns.${value}`) }))} onChange={(alignCross) => change({ alignCross })} />
      <div className="grid grid-cols-2 gap-2">
        <SelectField label={t("width")} value={layout.width} disabled={disabled} options={LAYOUT_SIZINGS.map((value) => ({ value, label: t(`sizings.${value}`) }))} onChange={(width) => change({ width })} />
        <SelectField label={t("height")} value={layout.height} disabled={disabled} options={LAYOUT_SIZINGS.map((value) => ({ value, label: t(`sizings.${value}`) }))} onChange={(height) => change({ height })} />
      </div>
    </div>
  );
}

export function AutoLayoutSection({ artboard, layers }: { artboard: Artboard; layers: Layer[] }) {
  const t = useTranslations("studio.image.layout");
  const tr = useTranslations("studio.image.layout.refused");
  const { commands } = useImageEditor();
  const [refused, setRefused] = useState<LayoutRefusal | null>(null);
  const group = scaffoldFor(artboard, layers.map((layer) => layer.id));
  const disabled = layers.some((layer) => layer.locked);
  if (!group?.layout && layers.length < 2 && !group) return null;
  return (
    <InspectorSection
      title={t("title")}
      action={
        group?.layout ? (
          <IconButton label={t("remove")} disabled={disabled} onClick={() => commands.removeLayout(group.id)} className="h-6 min-w-6 px-0.5 text-muted-foreground">
            <Trash className="h-3.5 w-3.5" aria-hidden />
          </IconButton>
        ) : null
      }
    >
      {group?.layout ? (
        <LayoutFields group={group} disabled={disabled} onRefused={setRefused} />
      ) : (
        <button type="button" disabled={disabled} onClick={() => setRefused(commands.setLayout(group ? { groupId: group.id } : { ids: layers.map((layer) => layer.id) }, {}))} className={OUTLINE_BUTTON_CLASS}>
          <Kanban className="h-3.5 w-3.5" aria-hidden />
          {t("add")}
        </button>
      )}
      {refused ? <Notice tone="fault" title={tr(refused)} /> : null}
    </InspectorSection>
  );
}

function containerOf(artboard: Artboard, layer: Layer): StudioGroup | undefined {
  const group = layer.groupId ? artboard.groups?.find((g) => g.id === layer.groupId) : undefined;
  return group?.layout && group.baseId !== layer.id ? group : undefined;
}

export function LayoutItemSection({ artboard, layers }: { artboard: Artboard; layers: Layer[] }) {
  const t = useTranslations("studio.image.layout.item");
  const tr = useTranslations("studio.image.layout.refused");
  const { commands } = useImageEditor();
  const [refused, setRefused] = useState<LayoutRefusal | null>(null);
  const layer = layers.length === 1 ? layers[0] : undefined;
  const container = layer ? containerOf(artboard, layer) : undefined;
  if (!layer || !container) return null;
  const spec: LayoutItem = layer.layoutItem ?? {};
  const choices = ITEM_SIZINGS.filter((value) => value !== "hug" || (layer.type === "text" && !layer.curve));
  const change = (patch: Partial<LayoutItem>) => setRefused(commands.setLayoutItem(layer.id, patch));
  const disabled = Boolean(layer.locked);
  return (
    <InspectorSection title={t("title")}>
      <SwitchRow label={t("absolute")} checked={Boolean(spec.absolute)} disabled={disabled} onChange={(absolute) => change({ absolute, ...(absolute ? { width: undefined, height: undefined } : {}) })} />
      {spec.absolute ? null : (
        <div className="grid grid-cols-2 gap-2">
          <SelectField<ItemSizing> label={t("width")} value={spec.width ?? "fixed"} disabled={disabled} options={choices.map((value) => ({ value, label: t(`sizings.${value}`) }))} onChange={(width) => change({ width })} />
          <SelectField<ItemSizing> label={t("height")} value={spec.height ?? "fixed"} disabled={disabled} options={choices.map((value) => ({ value, label: t(`sizings.${value}`) }))} onChange={(height) => change({ height })} />
        </div>
      )}
      {refused ? <Notice tone="fault" title={tr(refused)} /> : null}
      <p className="text-2xs text-muted-foreground">{spec.absolute ? t("absoluteHint") : t("hint")}</p>
    </InspectorSection>
  );
}
