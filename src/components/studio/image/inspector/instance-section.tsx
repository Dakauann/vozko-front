"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { ArrowCounterClockwise, ArrowUpRight, Eye, EyeSlash, LinkBreak, PuzzlePiece } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { STUDIO_ICON_IDS } from "@/components/studio/canvas/icon-catalog";
import type { ComponentRefusal } from "@/lib/studio/component-edits";
import { componentOf, overridableFields, overriddenLayer, setFields, type InstanceOverride, type OverrideValues } from "@/lib/studio/components";
import type { Artboard, Crop, Layer } from "@/lib/studio/document";
import { DEFAULT_FONT_ID, DEFAULT_FONT_WEIGHT, nearestFontWeight, STUDIO_FONTS, type FontId } from "@/lib/studio/fonts";
import { layerCaption } from "@/lib/studio/layer-list";
import { STUDIO_LIMITS } from "@/lib/studio/document";
import { cn } from "@/lib/utils";

import { useArtboardNames } from "../artboard-names";
import { FontPicker } from "../../inspector/font-picker";
import { ColorField, IconButton, InspectorSection, Notice, NumberField, OUTLINE_BUTTON_CLASS, SelectField, SwitchRow, TextField } from "../controls";
import { useImageDoc, useImageEditor } from "../editor-state";
import { ImageSourcePicker } from "../image-source-picker";

const FULL_CROP: Crop = { x: 0, y: 0, w: 1, h: 1 };
const CROP_KEYS = ["x", "y", "w", "h"] as const;

type Write = (values: OverrideValues) => boolean;

function PartImage({ part, disabled, write }: { part: Layer; disabled: boolean; write: Write }) {
  const t = useTranslations("studio.image.components.instance");
  const [open, setOpen] = useState(false);
  const crop = part.crop ?? FULL_CROP;
  const cropOf = (key: (typeof CROP_KEYS)[number], percent: number): Crop => {
    const next = { ...crop, [key]: Math.min(Math.max(percent / 100, key === "w" || key === "h" ? 0.01 : 0), 1) };
    return { ...next, w: Math.min(next.w, 1 - next.x), h: Math.min(next.h, 1 - next.y) };
  };
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" disabled={disabled} className={cn(OUTLINE_BUTTON_CLASS, "w-full")}>
            {t("image")}
          </button>
        </PopoverTrigger>
        <PopoverContent side="left" align="start" className="w-80">
          <ImageSourcePicker
            compact
            uploadLabel={t("upload")}
            onPick={async (mediaId) => {
              const ok = write({ assetId: mediaId });
              if (ok) setOpen(false);
              return ok;
            }}
          />
        </PopoverContent>
      </Popover>
      <fieldset className="grid grid-cols-4 gap-1.5" disabled={disabled}>
        <legend className="mb-1 text-2xs text-muted-foreground">{t("crop")}</legend>
        {CROP_KEYS.map((key) => (
          <NumberField key={key} label={t(`cropFields.${key}`)} short={t(`cropShort.${key}`)} value={crop[key] * 100} min={0} max={100} suffix="%" disabled={disabled} onCommit={(percent) => void write({ crop: cropOf(key, percent) })} />
        ))}
      </fieldset>
    </>
  );
}

function PartFields({ main, override, disabled, write }: { main: Layer; override: InstanceOverride | undefined; disabled: boolean; write: Write }) {
  const t = useTranslations("studio.image.components.instance");
  const tt = useTranslations("studio.image.inspector.text");
  const ti = useTranslations("studio.image.icons");
  const part = override ? overriddenLayer(main, override) : main;
  const allowed = new Set(overridableFields(main));
  const fontId: FontId = part.fontId ?? DEFAULT_FONT_ID;
  const font = STUDIO_FONTS[fontId];
  return (
    <div className="space-y-1.5">
      {allowed.has("text") ? <TextField label={t("text")} value={part.text ?? ""} maxLength={STUDIO_LIMITS.maxTextRunes} disabled={disabled} onCommit={(text) => write({ text })} /> : null}
      {allowed.has("fill") ? <ColorField label={t("fill")} value={part.fill ?? ""} disabled={disabled} onCommit={(fill) => void write({ fill })} /> : null}
      {allowed.has("stroke") ? <ColorField label={t("stroke")} value={part.stroke ?? ""} disabled={disabled} onCommit={(stroke) => void write({ stroke })} /> : null}
      {allowed.has("fontId") ? (
        <FontPicker
          label={t("font")}
          value={fontId}
          mixedLabel={tt("mixed")}
          disabled={disabled}
          onChange={(next) => void write({ fontId: next, fontWeight: nearestFontWeight(next, part.fontWeight || DEFAULT_FONT_WEIGHT), italic: part.italic && STUDIO_FONTS[next].italic ? true : undefined })}
        />
      ) : null}
      {allowed.has("fontWeight") ? (
        <SelectField
          label={t("weight")}
          value={nearestFontWeight(fontId, part.fontWeight || DEFAULT_FONT_WEIGHT)}
          disabled={disabled}
          options={font.weights.map((weight) => ({ value: weight, label: tt(`weights.${weight}`) }))}
          onChange={(fontWeight) => void write({ fontWeight })}
        />
      ) : null}
      {allowed.has("italic") && font.italic ? <SwitchRow label={t("italic")} checked={Boolean(part.italic)} disabled={disabled} onChange={(italic) => void write({ italic })} /> : null}
      {allowed.has("iconId") ? <SelectField label={t("icon")} value={part.iconId ?? ""} disabled={disabled} options={STUDIO_ICON_IDS.map((id) => ({ value: id, label: ti(id) }))} onChange={(iconId) => void write({ iconId })} /> : null}
      {allowed.has("assetId") ? <PartImage part={part} disabled={disabled} write={write} /> : null}
    </div>
  );
}

function PartRow({ instance, main, disabled, onRefused }: { instance: Layer; main: Layer; disabled: boolean; onRefused: (reason: ComponentRefusal | null) => void }) {
  const t = useTranslations("studio.image.components.instance");
  const tl = useTranslations("studio.image.layerKinds");
  const { commands } = useImageEditor();
  const override = instance.overrides?.find((o) => o.layerId === main.id);
  const changed = override ? setFields(override).length > 0 : false;
  const caption = layerCaption(main);
  const name = "name" in caption ? caption.name : tl(caption.kind);
  const hidden = Boolean(override?.hidden ?? main.hidden);
  const write: Write = (values) => {
    const refused = commands.setOverrides(instance.id, main.id, values);
    onRefused(refused);
    return refused === null;
  };
  return (
    <li className="space-y-1.5 border-t border-border pt-2 first:border-t-0 first:pt-0">
      <div className="flex min-h-6 items-center gap-1">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{name}</span>
        {changed ? <span role="img" aria-label={t("overridden")} title={t("overridden")} className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> : null}
        {changed ? (
          <IconButton label={t("reset", { name })} disabled={disabled} onClick={() => commands.resetOverrides(instance.id, main.id)} className="h-6 min-w-6 px-0.5 text-muted-foreground">
            <ArrowCounterClockwise className="h-3.5 w-3.5" aria-hidden />
          </IconButton>
        ) : null}
        <IconButton label={hidden ? t("show", { name }) : t("hide", { name })} disabled={disabled} onClick={() => void write({ hidden: !hidden })} className="h-6 min-w-6 px-0.5 text-muted-foreground">
          {hidden ? <EyeSlash className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
        </IconButton>
      </div>
      {hidden ? null : <PartFields main={main} override={override} disabled={disabled} write={write} />}
    </li>
  );
}

export function InstanceSection({ layer }: { layer: Layer }) {
  const t = useTranslations("studio.image.components.instance");
  const tr = useTranslations("studio.image.components.refused");
  const { commands } = useImageEditor();
  const document = useImageDoc((s) => s.document);
  const names = useArtboardNames();
  const [refused, setRefused] = useState<ComponentRefusal | null>(null);
  const component: Artboard | undefined = componentOf(document, layer.componentId);
  if (!component) {
    return (
      <InspectorSection title={t("title")}>
        <Notice tone="fault" title={t("missing")} />
      </InspectorSection>
    );
  }
  const disabled = Boolean(layer.locked);
  const components = document.artboards.filter((a) => a.component);
  const overridden = (layer.overrides ?? []).length > 0;
  return (
    <InspectorSection title={t("title")}>
      <div className="flex min-h-7 items-center gap-1.5">
        <PuzzlePiece className="h-4 w-4 shrink-0 text-primary" weight="fill" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{names.get(component.id)}</span>
        <IconButton label={t("goTo")} onClick={() => commands.showComponent(component.id)} className="h-7 min-w-7 text-muted-foreground">
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
      </div>
      {components.length > 1 ? (
        <SelectField label={t("swap")} value={component.id} disabled={disabled} options={components.map((c) => ({ value: c.id, label: names.get(c.id) ?? c.id }))} onChange={(id) => commands.swapComponent(layer.id, id)} />
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={disabled} onClick={() => commands.detachInstances([layer.id])} className={OUTLINE_BUTTON_CLASS}>
          <LinkBreak className="h-3.5 w-3.5" aria-hidden />
          {t("detach")}
        </button>
        <button type="button" disabled={disabled || !overridden} onClick={() => commands.resetOverrides(layer.id)} className={OUTLINE_BUTTON_CLASS}>
          <ArrowCounterClockwise className="h-3.5 w-3.5" aria-hidden />
          {t("resetAll")}
        </button>
      </div>
      {refused ? <Notice tone="fault" title={tr(refused)} /> : null}
      <h4 className="pt-1 text-2xs font-medium text-muted-foreground">{t("parts")}</h4>
      <ul className="space-y-2">
        {[...component.layers].reverse().map((main) => (
          <PartRow key={main.id} instance={layer} main={main} disabled={disabled} onRefused={setRefused} />
        ))}
      </ul>
      <p className="text-2xs text-muted-foreground">{t("hint")}</p>
    </InspectorSection>
  );
}
