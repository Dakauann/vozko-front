"use client";

import { useTranslations } from "next-intl";

import { CapIcon, JoinIcon } from "@/components/studio/canvas/vector/stroke-icons";
import { LINE_CAPS, LINE_JOINS, type Layer } from "@/lib/studio/document";
import { LAYER_RANGES } from "@/lib/studio/layer-ranges";
import { strokeStyle } from "@/lib/studio/paint";
import { sharedValue } from "@/lib/studio/selection-edit";
import { DASH_PRESET_IDS, dashPresetOf, dashPresetPatch, type DashPreset } from "@/lib/studio/stroke-presets";

import { ToolButton } from "../tool-button";
import { FieldGrid, NumberField, SelectField } from "./fields";

type DashChoice = DashPreset | "custom";

interface StrokeStyleFieldsProps {
  layers: readonly Layer[];
  withCaps: boolean;
  disabled?: boolean;
  onPatch: (patch: Partial<Layer>) => void;
}

export function StrokeStyleFields({ layers, withCaps, disabled, onPatch }: StrokeStyleFieldsProps) {
  const t = useTranslations("studio.vectors.stroke");
  const shared = <T,>(get: (layer: Layer) => T): T | null => {
    const value = sharedValue(layers, get);
    return value.kind === "same" ? value.value : null;
  };
  const preset = shared((layer): DashChoice => dashPresetOf(layer));
  const dashed = layers.every((layer) => dashPresetOf(layer) !== "solid");
  const cap = shared((layer) => strokeStyle(layer).lineCap);
  const join = shared((layer) => strokeStyle(layer).lineJoin);
  const options = [...DASH_PRESET_IDS, ...(preset === "custom" ? (["custom"] as const) : [])].map((id) => ({ value: id as DashChoice, label: t(`dashes.${id}`) }));

  return (
    <div className="space-y-2">
      <FieldGrid>
        <SelectField<DashChoice> label={t("dash")} value={preset} options={options} disabled={disabled} onChange={(id) => id !== "custom" && onPatch(dashPresetPatch(id))} />
        {dashed ? (
          <NumberField
            label={t("dashOffset")}
            decimals={1}
            step={0.5}
            min={LAYER_RANGES.dashOffset[0]}
            max={LAYER_RANGES.dashOffset[1]}
            value={shared((layer) => layer.dashOffset ?? 0)}
            disabled={disabled}
            onCommit={(value) => onPatch({ dashOffset: value === 0 ? undefined : value })}
          />
        ) : null}
      </FieldGrid>
      {withCaps ? (
        <div role="group" aria-label={t("caps")} className="flex items-center gap-1">
          <span className="w-20 shrink-0 text-2xs text-muted-foreground">{t("caps")}</span>
          {LINE_CAPS.map((value) => (
            <ToolButton key={value} size="sm" label={t(`cap.${value}`)} pressed={cap === value} disabled={disabled} icon={<CapIcon cap={value} className="h-4 w-4" />} onClick={() => onPatch({ lineCap: value })} />
          ))}
        </div>
      ) : null}
      <div role="group" aria-label={t("joins")} className="flex items-center gap-1">
        <span className="w-20 shrink-0 text-2xs text-muted-foreground">{t("joins")}</span>
        {LINE_JOINS.map((value) => (
          <ToolButton key={value} size="sm" label={t(`join.${value}`)} pressed={join === value} disabled={disabled} icon={<JoinIcon join={value} className="h-4 w-4" />} onClick={() => onPatch({ lineJoin: value })} />
        ))}
      </div>
      {join === "miter" ? (
        <FieldGrid>
          <NumberField
            label={t("miterLimit")}
            step={1}
            min={LAYER_RANGES.miterLimit[0]}
            max={LAYER_RANGES.miterLimit[1]}
            value={shared((layer) => strokeStyle(layer).miterLimit)}
            disabled={disabled}
            onCommit={(miterLimit) => onPatch({ miterLimit })}
          />
        </FieldGrid>
      ) : null}
    </div>
  );
}
