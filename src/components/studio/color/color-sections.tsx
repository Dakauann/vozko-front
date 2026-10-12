"use client";

import { useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { UploadSimple } from "@/components/icons";
import type { ExtrasChange } from "@/lib/studio/color-grade";
import { CURVE_PRESET_IDS, curvePresetPoints, isNeutralCurves, withCurve, type ColorCurves } from "@/lib/studio/color-curves";
import { DEFAULT_HUE_SECONDARY, HUE_RANGES, isNeutralHue, type HueSecondary } from "@/lib/studio/hue-secondary";
import { lutIntensity, type GradeLut } from "@/lib/studio/cube-lut";
import { cn } from "@/lib/utils";

import { useLoadedLut } from "../canvas/lut-files";
import { IconButton, InspectorSection, Notice, OUTLINE_BUTTON_CLASS, SelectField, SliderField } from "../image/controls";
import { CurveEditor } from "./curve-editor";
import { HuePicker } from "./hue-picker";
import { useLutLibrary, type LutImport } from "./use-lut-library";

const PERCENT = 100;
const NONE = "";

export interface FinishSectionProps {
  disabled: boolean;
  onGrade: (change: ExtrasChange) => void;
  onStart: () => void;
  onEnd: () => void;
}

export function CurvesSection({ curves, disabled, onGrade, onStart, onEnd }: FinishSectionProps & { curves: ColorCurves | undefined }) {
  const t = useTranslations("studio.color.curves");
  const shaped = !isNeutralCurves(curves);
  return (
    <InspectorSection id="curves" title={t("title")} summary={shaped ? t("summary") : null} reset={{ label: t("reset"), disabled: disabled || !shaped, onReset: () => onGrade({ curves: null }) }}>
      <CurveEditor curves={curves} disabled={disabled} onStart={onStart} onEnd={onEnd} onChange={(next) => onGrade({ curves: next ?? null })} />
      <div role="group" aria-label={t("presets")} className="flex flex-wrap gap-1">
        {CURVE_PRESET_IDS.map((preset) => (
          <button key={preset} type="button" disabled={disabled} className={cn(OUTLINE_BUTTON_CLASS, "h-7")} onClick={() => onGrade({ curves: withCurve(curves, "master", curvePresetPoints(preset)) ?? null })}>
            {t(`presetNames.${preset}`)}
          </button>
        ))}
      </div>
    </InspectorSection>
  );
}

export function SelectiveColorSection({ hsl, disabled, onGrade, onStart, onEnd }: FinishSectionProps & { hsl: HueSecondary | undefined }) {
  const t = useTranslations("studio.color.hsl");
  const format = useFormatter();
  const [draft, setDraft] = useState<HueSecondary>(DEFAULT_HUE_SECONDARY);
  const on = Boolean(hsl);
  const shown = hsl ?? draft;
  const set = (next: HueSecondary) => {
    setDraft(next);
    onGrade({ hsl: isNeutralHue(next) ? null : next });
  };
  const slider = (field: "width" | "softness" | "desaturate" | "shift" | "saturation", unit: string) => {
    const [min, max] = HUE_RANGES[field];
    return (
      <SliderField
        key={field}
        label={t(field)}
        value={shown[field] ?? 0}
        min={min}
        max={max}
        step={1}
        format={(value) => `${format.number(value, { signDisplay: field === "shift" || field === "saturation" ? "exceptZero" : "auto" })}${unit}`}
        disabled={disabled || !on}
        onStart={onStart}
        onEnd={onEnd}
        onChange={(value) => set({ ...shown, [field]: value })}
      />
    );
  };
  return (
    <InspectorSection
      id="selectiveColor"
      title={t("title")}
      summary={hsl ? t("summary", { hue: hsl.hue }) : null}
      toggle={{ label: t("toggle"), checked: on, disabled, onChange: (checked) => onGrade({ hsl: checked ? (isNeutralHue(draft) ? DEFAULT_HUE_SECONDARY : draft) : null }) }}
    >
      <HuePicker secondary={shown} disabled={disabled || !on} onStart={onStart} onEnd={onEnd} onChange={set} />
      {slider("width", "°")}
      {slider("softness", "°")}
      <p className="text-2xs font-semibold uppercase text-muted-foreground">{t("outside")}</p>
      {slider("desaturate", "%")}
      <p className="text-2xs font-semibold uppercase text-muted-foreground">{t("inside")}</p>
      {slider("shift", "°")}
      {slider("saturation", "")}
      <p className="text-2xs text-muted-foreground">{t("hint")}</p>
    </InspectorSection>
  );
}

function importNotice(result: LutImport | null): string | null {
  return result && !result.ok ? result.fault : null;
}

export function LutSection({ lut, disabled, onGrade, onStart, onEnd }: FinishSectionProps & { lut: GradeLut | undefined }) {
  const t = useTranslations("studio.color.lut");
  const format = useFormatter();
  const library = useLutLibrary();
  const loaded = useLoadedLut(lut?.assetId ?? null);
  const picker = useRef<HTMLInputElement>(null);
  const [imported, setImported] = useState<LutImport | null>(null);
  const fault = importNotice(imported);
  const choices = library.luts ?? [];
  const known = lut && !choices.some((media) => media.id === lut.assetId) ? [{ value: lut.assetId, label: t("current") }] : [];
  return (
    <InspectorSection id="lut" title={t("title")} summary={lut ? (choices.find((media) => media.id === lut.assetId)?.description ?? t("current")) : null} reset={{ label: t("remove"), disabled: disabled || !lut, onReset: () => onGrade({ lut: null }) }}>
      <SelectField<string>
        label={t("choose")}
        value={lut?.assetId ?? NONE}
        options={[{ value: NONE, label: library.luts === null ? t("loading") : t("none") }, ...choices.map((media) => ({ value: media.id, label: media.description || media.id })), ...known]}
        disabled={disabled}
        onChange={(id) => onGrade({ lut: id === NONE ? null : { assetId: id, ...(lut?.intensity !== undefined ? { intensity: lut.intensity } : {}) } })}
      />
      <input
        ref={picker}
        type="file"
        accept=".cube"
        className="hidden"
        aria-label={t("import")}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const result = await library.importFile(file);
          setImported(result);
          if (result.ok) onGrade({ lut: { assetId: result.mediaId } });
        }}
      />
      <IconButton label={library.importing ? t("importing") : t("import")} showLabel disabled={disabled || library.importing} onClick={() => picker.current?.click()}>
        <UploadSimple className="h-3.5 w-3.5" aria-hidden />
      </IconButton>
      {lut ? (
        <SliderField
          label={t("intensity")}
          value={Math.round(lutIntensity(lut) * PERCENT)}
          min={0}
          max={PERCENT}
          step={1}
          format={(value) => format.number(value / PERCENT, { style: "percent" })}
          disabled={disabled}
          onStart={onStart}
          onEnd={onEnd}
          onChange={(value) => onGrade({ lut: { assetId: lut.assetId, ...(value !== PERCENT ? { intensity: value / PERCENT } : {}) } })}
        />
      ) : null}
      {loaded.status === "failed" ? <Notice tone="fault" title={t("unreadable")} /> : null}
      {fault ? <Notice tone="fault" title={t(`faults.${fault}`)} /> : null}
      <p className="text-2xs text-muted-foreground">{t("hint")}</p>
    </InspectorSection>
  );
}
