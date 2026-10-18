"use client";

import { useTranslations } from "next-intl";

import { Plus, Trash } from "@/components/icons";
import {
  addedStop,
  DEFAULT_GRADIENT_MAP_PRESET,
  GRADIENT_MAP_INTERPOLATIONS,
  GRADIENT_MAP_PRESET_IDS,
  gradientMapOfPreset,
  movedStop,
  presetOfStops,
  removedStop,
  type GradientMap,
  type GradientMapInterpolation,
  type GradientMapPreset,
} from "@/lib/studio/gradient-map";

import { ColorField, IconButton, InspectorSection, NumberField, SelectField, SliderField, SwitchRow, SwitchToggle } from "../image/controls";

const CUSTOM = "custom";

interface GradientMapSectionProps {
  map: GradientMap | undefined;
  disabled: boolean;
  onChange: (map: GradientMap | undefined) => void;
  onStart: () => void;
  onEnd: () => void;
}

export function GradientMapSection({ map, disabled, onChange, onStart, onEnd }: GradientMapSectionProps) {
  const t = useTranslations("studio.image.paint.gradientMap");
  const preset = map ? (presetOfStops(map.stops) ?? CUSTOM) : CUSTOM;
  return (
    <InspectorSection
      id="gradientMap"
      title={t("title")}
      action={<SwitchToggle label={t("toggle")} checked={Boolean(map)} disabled={disabled} onChange={(on) => onChange(on ? { stops: gradientMapOfPreset(DEFAULT_GRADIENT_MAP_PRESET), intensity: 1 } : undefined)} />}
    >
      {map ? (
        <div className="space-y-2">
          <SelectField<GradientMapPreset | typeof CUSTOM>
            label={t("preset")}
            value={preset}
            options={[...GRADIENT_MAP_PRESET_IDS.map((id) => ({ value: id as GradientMapPreset | typeof CUSTOM, label: t(`presets.${id}`) })), ...(preset === CUSTOM ? [{ value: CUSTOM as typeof CUSTOM, label: t("presetCustom") }] : [])]}
            disabled={disabled}
            onChange={(id) => id !== CUSTOM && onChange({ ...map, stops: gradientMapOfPreset(id) })}
          />
          {map.stops.map((stop, index) => (
            <div key={index} className="flex items-end gap-1">
              <div className="min-w-0 flex-1">
                <ColorField label={t("stop", { number: index + 1 })} value={stop.color} disabled={disabled} onCommit={(color) => onChange({ ...map, stops: map.stops.map((s, i) => (i === index ? { ...s, color } : s)) })} />
              </div>
              <div className="w-20 shrink-0">
                <NumberField bare label={t("stopAt", { number: index + 1 })} value={Math.round(stop.at * 100)} min={0} max={100} suffix="%" disabled={disabled} onCommit={(at) => onChange(movedStop(map, index, at / 100))} />
              </div>
              <IconButton label={t("removeStop", { number: index + 1 })} disabled={disabled || map.stops.length <= 2} onClick={() => onChange(removedStop(map, index))}>
                <Trash className="h-3.5 w-3.5" aria-hidden />
              </IconButton>
            </div>
          ))}
          <IconButton label={t("addStop")} showLabel disabled={disabled} onClick={() => onChange(addedStop(map))}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </IconButton>
          <SliderField
            label={t("intensity")}
            value={Math.round(map.intensity * 100)}
            min={0}
            max={100}
            step={1}
            format={(v) => `${v}%`}
            entry={{ range: [0, 1], scale: 100, suffix: "%" }}
            disabled={disabled}
            onStart={onStart}
            onEnd={onEnd}
            onChange={(v) => onChange({ ...map, intensity: v / 100 })}
          />
          <SwitchRow label={t("reverse")} checked={Boolean(map.reverse)} disabled={disabled} onChange={(on) => onChange({ ...map, reverse: on || undefined })} />
          <SelectField<GradientMapInterpolation>
            label={t("interpolation")}
            value={map.interpolation || "perceptual"}
            options={GRADIENT_MAP_INTERPOLATIONS.map((mode) => ({ value: mode, label: t(`interpolations.${mode}`) }))}
            disabled={disabled}
            onChange={(mode) => onChange({ ...map, interpolation: mode === "perceptual" ? undefined : mode })}
          />
        </div>
      ) : null}
    </InspectorSection>
  );
}
