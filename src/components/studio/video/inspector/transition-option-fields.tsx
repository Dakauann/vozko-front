"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GRADIENT_WIPE_MAPS, type GradientWipeMap } from "@/lib/studio/reveal-field";
import { IRIS_SHAPES, optionValue, SIZE_RANGE, SLIDE_MOVES, SPLIT_ORIENTATIONS, TRANSITION_DIRECTIONS, visibleOptions, type Transition, type TransitionOption, type TransitionOptions } from "@/lib/studio/transitions";

import { ImageSourcePicker } from "../../image/image-source-picker";
import { ColorField, NumberField, SelectField, ToggleField } from "./fields";

type Shaped = Pick<Transition, "kind"> & TransitionOptions;

const PERCENT = 100;
const PICTURE = "picture";

type MapChoice = GradientWipeMap | typeof PICTURE;

const TRIGGER_CLASS =
  "flex h-8 w-full items-center justify-center rounded-[--radius] border border-control-edge bg-card px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

interface FieldProps {
  shaped: Shaped;
  edge: boolean;
  disabled?: boolean;
  patch: (next: TransitionOptions) => void;
}

function reverseKey(shaped: Shaped, edge: boolean): string {
  if (shaped.kind === "gradientWipe") return "options.reverseMap";
  return edge ? "options.reverseEdge" : "options.reverse";
}

function MapField({ shaped, disabled, patch }: Omit<FieldProps, "edge">) {
  const t = useTranslations("studio.video.transitions");
  const [open, setOpen] = useState(false);
  const choice: MapChoice = shaped.mapAssetId ? PICTURE : optionValue(shaped, "map");
  const options = [...GRADIENT_WIPE_MAPS.map((value) => ({ value: value as MapChoice, label: t(`maps.${value}`) })), ...(choice === PICTURE ? [{ value: PICTURE as MapChoice, label: t("maps.picture") }] : [])];
  return (
    <div className="space-y-1.5">
      <SelectField<MapChoice> label={t("options.map")} value={choice} options={options} disabled={disabled} onChange={(map) => map !== PICTURE && patch({ map })} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" disabled={disabled} className={TRIGGER_CLASS}>
            {t("mapPicture")}
          </button>
        </PopoverTrigger>
        <PopoverContent side="left" align="start" className="w-80">
          <ImageSourcePicker
            compact
            uploadLabel={t("mapUpload")}
            onPick={async (mediaId) => {
              patch({ mapAssetId: mediaId });
              setOpen(false);
              return true;
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function OptionField({ shaped, option, edge, disabled, patch }: FieldProps & { option: TransitionOption }) {
  const t = useTranslations("studio.video.transitions");
  const label = t(`options.${option}`);
  switch (option) {
    case "direction":
      return <SelectField label={label} value={optionValue(shaped, "direction")} disabled={disabled} options={TRANSITION_DIRECTIONS.map((value) => ({ value, label: t(`directions.${value}`) }))} onChange={(direction) => patch({ direction })} />;
    case "moving":
      return <SelectField label={label} value={optionValue(shaped, "moving")} disabled={disabled} options={SLIDE_MOVES.map((value) => ({ value, label: t(`moves.${value}`) }))} onChange={(moving) => patch({ moving })} />;
    case "color":
      return <ColorField label={label} value={optionValue(shaped, "color")} disabled={disabled} opaque onChange={(color) => patch({ color })} />;
    case "angle":
      return <NumberField label={label} unit="°" min={0} max={359} disabled={disabled} value={optionValue(shaped, "angle")} onCommit={(angle) => patch({ angle: Math.round(angle) })} />;
    case "shape":
      return <SelectField label={label} value={optionValue(shaped, "shape")} disabled={disabled} options={IRIS_SHAPES.map((value) => ({ value, label: t(`shapes.${value}`) }))} onChange={(shape) => patch({ shape })} />;
    case "orientation":
      return <SelectField label={label} value={optionValue(shaped, "orientation")} disabled={disabled} options={SPLIT_ORIENTATIONS.map((value) => ({ value, label: t(`orientations.${value}`) }))} onChange={(orientation) => patch({ orientation })} />;
    case "clockwise":
      return <ToggleField label={label} checked={optionValue(shaped, "clockwise")} disabled={disabled} onChange={(clockwise) => patch({ clockwise })} />;
    case "reverse":
      return <ToggleField label={t(reverseKey(shaped, edge))} checked={optionValue(shaped, "reverse")} disabled={disabled} onChange={(reverse) => patch({ reverse })} />;
    case "originX":
    case "originY":
    case "amount":
    case "softness":
      return <NumberField label={label} unit="%" min={0} max={PERCENT} disabled={disabled} value={Math.round(optionValue(shaped, option) * PERCENT)} onCommit={(value) => patch({ [option]: value / PERCENT })} />;
    case "size":
      return <NumberField label={label} unit="%" min={SIZE_RANGE[0] * PERCENT} max={SIZE_RANGE[1] * PERCENT} disabled={disabled} value={Math.round(optionValue(shaped, "size") * PERCENT)} onCommit={(value) => patch({ size: value / PERCENT })} />;
    case "map":
    case "mapAssetId":
      return <MapField shaped={shaped} disabled={disabled} patch={patch} />;
  }
}

export function TransitionOptionFields({ shaped, allowed, edge, disabled, patch }: FieldProps & { allowed: readonly TransitionOption[] }) {
  return (
    <>
      {visibleOptions(shaped, allowed).map((option) => (
        <OptionField key={option} shaped={shaped} option={option} edge={edge} disabled={disabled} patch={patch} />
      ))}
    </>
  );
}
