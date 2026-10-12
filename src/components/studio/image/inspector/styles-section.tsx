"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { CaretDown, CaretRight, Cursor, LinkBreak, Plus, Trash } from "@/components/icons";
import type { Artboard, Layer } from "@/lib/studio/document";
import { DEFAULT_FONT_ID, STUDIO_FONTS, type FontId } from "@/lib/studio/fonts";
import { LAYER_RANGES } from "@/lib/studio/layer-ranges";
import { styleUses, textStyleFields, type StylePatchInput, type StyleRefusal } from "@/lib/studio/shared-style-edits";
import { LAYER_SLOTS, SLOT_KEYS, SLOT_KIND, STYLE_KINDS, STYLE_RANGES, STYLE_ROLES, slotSuits, type LayerSlot, type StudioStyle, type StyleKind, type StyleRole, type TextStyleField } from "@/lib/studio/shared-styles";
import { cn } from "@/lib/utils";

import { FontPicker } from "../../inspector/font-picker";
import { ColorField, IconButton, InspectorSection, Notice, NumberField, SelectField, SwitchRow, TextField } from "../controls";
import { useActiveArtboard, useImageDoc, useImageEditor } from "../editor-state";
import { GradientFields, ShadowFields } from "./effects";

const NONE = "";
const MIXED = "mixed";
const PROBES: Record<StyleKind, StudioStyle> = {
  color: { id: "probe", kind: "color", name: "probe", color: "#000000" },
  text: { id: "probe", kind: "text", name: "probe", fontId: DEFAULT_FONT_ID },
  effect: { id: "probe", kind: "effect", name: "probe", shadow: { color: "#000000", blur: 0, x: 0, y: 0 } },
};
const TEXT_DEFAULTS: Required<Pick<StudioStyle, TextStyleField>> = { fontId: DEFAULT_FONT_ID, fontWeight: 700, italic: true, fontSizePx: 48, lineHeight: 1.2, letterSpacing: 0.02 };

function swatchStyle(style: StudioStyle): CSSProperties {
  if (style.kind === "color") return { background: style.gradient ? `linear-gradient(${style.gradient.angle + 90}deg, ${style.gradient.from}, ${style.gradient.via ? `${style.gradient.via}, ` : ""}${style.gradient.to})` : style.color };
  if (style.kind === "effect" && style.shadow) return { boxShadow: `${style.shadow.x / 4}px ${style.shadow.y / 4}px ${style.shadow.blur / 4}px ${style.shadow.color}` };
  return { fontFamily: style.fontId ? STUDIO_FONTS[style.fontId].family : undefined, fontWeight: style.fontWeight, fontStyle: style.italic ? "italic" : undefined };
}

function Swatch({ style }: { style: StudioStyle }) {
  return (
    <span aria-hidden className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border border-border text-2xs leading-none text-foreground", style.kind !== "color" && "bg-card")} style={swatchStyle(style)}>
      {style.kind === "text" ? "Aa" : null}
    </span>
  );
}

function useStyleNames() {
  const t = useTranslations("studio.image.styles");
  const styles = useImageDoc((s) => s.document.styles) ?? [];
  return (kind: StyleKind) => t(`defaults.${kind}`, { number: styles.filter((style) => style.kind === kind).length + 1 });
}

function SlotRow({ slot, layers, disabled, onRefused }: { slot: LayerSlot; layers: Layer[]; disabled: boolean; onRefused: (reason: StyleRefusal | null) => void }) {
  const t = useTranslations("studio.image.styles");
  const { commands } = useImageEditor();
  const styles = useImageDoc((s) => s.document.styles) ?? [];
  const nameFor = useStyleNames();
  const kind = SLOT_KIND[slot];
  const links = new Set(layers.map((layer) => layer[SLOT_KEYS[slot]] ?? NONE));
  const value = links.size === 1 ? [...links][0] : MIXED;
  const choices = styles.filter((style) => style.kind === kind && layers.every((layer) => slotSuits(layer, slot, style)));
  const targets = layers.map((layer) => ({ kind: "layer" as const, layerId: layer.id }));
  const options = [...(value === MIXED ? [{ value: MIXED, label: t("mixed") }] : []), { value: NONE, label: t("none") }, ...choices.map((style) => ({ value: style.id, label: style.name }))];
  const choose = (id: string) => {
    if (id === MIXED) return;
    if (id === NONE) {
      commands.detachStyle(targets, slot);
      onRefused(null);
      return;
    }
    onRefused(commands.applyStyle(id, targets, slot));
  };
  return (
    <div className="flex items-end gap-1">
      <div className="min-w-0 flex-1">
        <SelectField label={t(`slots.${slot}`)} value={value} options={options} disabled={disabled} onChange={choose} />
      </div>
      {value !== NONE && value !== MIXED ? (
        <IconButton label={t("detach", { slot: t(`slots.${slot}`) })} disabled={disabled} onClick={() => commands.detachStyle(targets, slot)} className="text-muted-foreground">
          <LinkBreak className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
      ) : null}
      <IconButton label={t("create", { slot: t(`slots.${slot}`) })} disabled={disabled || layers.length !== 1} onClick={() => onRefused(commands.createStyle({ kind, name: nameFor(kind), from: { layerId: layers[0].id, slot } }))} className="text-muted-foreground">
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </IconButton>
    </div>
  );
}

export function LayerStylesSection({ layers }: { layers: Layer[] }) {
  const t = useTranslations("studio.image.styles");
  const tr = useTranslations("studio.image.styles.refused");
  const [refused, setRefused] = useState<StyleRefusal | null>(null);
  const slots = LAYER_SLOTS.filter((slot) => layers.length > 0 && layers.every((layer) => slotSuits(layer, slot, PROBES[SLOT_KIND[slot]])));
  if (slots.length === 0) return null;
  const disabled = layers.some((layer) => layer.locked);
  return (
    <InspectorSection title={t("title")}>
      {slots.map((slot) => (
        <SlotRow key={slot} slot={slot} layers={layers} disabled={disabled} onRefused={setRefused} />
      ))}
      {refused ? <Notice tone="fault" title={tr(refused)} /> : null}
      <p className="text-2xs text-muted-foreground">{t("linkedHint")}</p>
    </InspectorSection>
  );
}

function TextValues({ style, onChange }: { style: StudioStyle; onChange: (values: StylePatchInput) => void }) {
  const t = useTranslations("studio.image.styles");
  const tt = useTranslations("studio.image.inspector.text");
  const fontId: FontId = style.fontId ?? DEFAULT_FONT_ID;
  const governed = new Set(textStyleFields(style));
  const toggle = (field: TextStyleField, on: boolean) => onChange({ [field]: on ? TEXT_DEFAULTS[field] : null });
  const field = (name: TextStyleField, control: ReactNode) => (
    <div key={name} className="space-y-1">
      <SwitchRow label={t(`fields.${name}`)} checked={governed.has(name)} onChange={(on) => toggle(name, on)} />
      {governed.has(name) ? control : null}
    </div>
  );
  return (
    <div className="space-y-1.5">
      {field("fontId", <FontPicker label={t("fields.fontId")} value={fontId} mixedLabel={tt("mixed")} onChange={(next) => onChange({ fontId: next })} />)}
      {field("fontWeight", <SelectField label={t("fields.fontWeight")} value={style.fontWeight ?? 400} options={STUDIO_FONTS[fontId].weights.map((weight) => ({ value: weight, label: tt(`weights.${weight}`) }))} onChange={(fontWeight) => onChange({ fontWeight })} />)}
      {field("fontSizePx", <NumberField label={t("fields.fontSizePx")} value={style.fontSizePx ?? 0} min={STYLE_RANGES.fontSizePx[0]} max={STYLE_RANGES.fontSizePx[1]} step={0.5} decimals={1} suffix="px" onCommit={(fontSizePx) => onChange({ fontSizePx })} />)}
      {field("lineHeight", <NumberField label={t("fields.lineHeight")} value={style.lineHeight ?? 0} min={LAYER_RANGES.lineHeight[0]} max={LAYER_RANGES.lineHeight[1]} step={0.05} decimals={2} onCommit={(lineHeight) => onChange({ lineHeight })} />)}
      {field("letterSpacing", <NumberField label={t("fields.letterSpacing")} value={style.letterSpacing ?? 0} min={LAYER_RANGES.letterSpacing[0]} max={LAYER_RANGES.letterSpacing[1]} step={0.01} decimals={2} suffix="em" onCommit={(letterSpacing) => onChange({ letterSpacing: letterSpacing || null })} />)}
      {field("italic", null)}
    </div>
  );
}

function StyleEditor({ style, onRefused }: { style: StudioStyle; onRefused: (reason: StyleRefusal | null) => void }) {
  const t = useTranslations("studio.image.styles");
  const { commands } = useImageEditor();
  const update = (patch: Parameters<typeof commands.updateStyle>[1]) => onRefused(commands.updateStyle(style.id, patch));
  return (
    <div className="space-y-2 rounded-[--radius] border border-border p-2">
      <TextField label={t("name")} value={style.name} maxLength={128} onCommit={(name) => name.trim() !== "" && update({ name })} />
      <TextField label={t("description")} value={style.description ?? ""} maxLength={STYLE_RANGES.descriptionRunes} onCommit={(description) => update({ description })} />
      {style.kind === "text" ? (
        <SelectField<StyleRole | typeof NONE>
          label={t("role")}
          value={style.role ?? NONE}
          options={[{ value: NONE, label: t("roles.none") }, ...STYLE_ROLES.map((role) => ({ value: role, label: t(`roles.${role}`) }))]}
          onChange={(role) => update({ role: role === NONE ? null : role })}
        />
      ) : null}
      {style.kind === "color" ? (
        <>
          {style.gradient ? null : <ColorField label={t("color")} value={style.color ?? ""} onCommit={(color) => update({ values: { color } })} />}
          <GradientFields gradient={style.gradient} fallback={style.color ?? "#000000"} disabled={false} onChange={(gradient) => update({ values: gradient ? { gradient } : { color: style.gradient?.from ?? "#000000" } })} />
        </>
      ) : null}
      {style.kind === "effect" && style.shadow ? <ShadowFields shadow={style.shadow} disabled={false} onChange={(shadow) => update({ values: { shadow } })} /> : null}
      {style.kind === "text" ? <TextValues style={style} onChange={(values) => update({ values })} /> : null}
    </div>
  );
}

function StyleRow({ style, onRefused }: { style: StudioStyle; onRefused: (reason: StyleRefusal | null) => void }) {
  const t = useTranslations("studio.image.styles");
  const { commands } = useImageEditor();
  const document = useImageDoc((s) => s.document);
  const [open, setOpen] = useState(false);
  const uses = styleUses(document, style.id).length;
  return (
    <li className="space-y-1.5">
      <div className="flex min-h-7 items-center gap-1.5">
        <button type="button" aria-expanded={open} aria-label={t("edit", { name: style.name })} onClick={() => setOpen((value) => !value)} className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[--radius] px-1 py-0.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {open ? <CaretDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden /> : <CaretRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />}
          <Swatch style={style} />
          <span className="min-w-0 flex-1 truncate text-xs text-foreground">{style.name}</span>
          <span className="readout shrink-0 text-2xs text-muted-foreground">{t("uses", { count: uses })}</span>
        </button>
        <IconButton label={t("selectUses", { name: style.name })} disabled={uses === 0} onClick={() => commands.selectStyleUses(style.id)} className="h-6 min-w-6 px-0.5 text-muted-foreground">
          <Cursor className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
        <IconButton label={t("delete", { name: style.name })} onClick={() => commands.deleteStyle(style.id)} className="h-6 min-w-6 px-0.5 text-muted-foreground">
          <Trash className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
      </div>
      {open ? <StyleEditor style={style} onRefused={onRefused} /> : null}
    </li>
  );
}

function BackgroundRow({ artboard, onRefused }: { artboard: Artboard; onRefused: (reason: StyleRefusal | null) => void }) {
  const t = useTranslations("studio.image.styles");
  const { commands } = useImageEditor();
  const styles = useImageDoc((s) => s.document.styles) ?? [];
  const nameFor = useStyleNames();
  const target = [{ kind: "background" as const, artboardId: artboard.id }];
  const colors = styles.filter((style) => style.kind === "color");
  const value = artboard.canvas.backgroundStyleId ?? NONE;
  return (
    <div className="flex items-end gap-1">
      <div className="min-w-0 flex-1">
        <SelectField
          label={t("slots.background")}
          value={value}
          options={[{ value: NONE, label: t("none") }, ...colors.map((style) => ({ value: style.id, label: style.name }))]}
          onChange={(id) => (id === NONE ? commands.detachStyle(target, "background") : onRefused(commands.applyStyle(id, target)))}
        />
      </div>
      <IconButton label={t("create", { slot: t("slots.background") })} disabled={artboard.canvas.background === "" && !artboard.canvas.gradient} onClick={() => onRefused(commands.createStyle({ kind: "color", name: nameFor("color"), from: { artboardId: artboard.id, slot: "background" } }))} className="text-muted-foreground">
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </IconButton>
    </div>
  );
}

export function DocumentStylesSection() {
  const t = useTranslations("studio.image.styles");
  const tr = useTranslations("studio.image.styles.refused");
  const artboard = useActiveArtboard();
  const styles = useImageDoc((s) => s.document.styles) ?? [];
  const [refused, setRefused] = useState<StyleRefusal | null>(null);
  return (
    <InspectorSection title={t("title")}>
      <BackgroundRow artboard={artboard} onRefused={setRefused} />
      {refused ? <Notice tone="fault" title={tr(refused)} /> : null}
      {styles.length === 0 ? <p className="text-2xs text-muted-foreground">{t("empty")}</p> : null}
      {STYLE_KINDS.map((kind) => {
        const group = styles.filter((style) => style.kind === kind);
        if (group.length === 0) return null;
        return (
          <div key={kind} className="space-y-1">
            <h4 className="text-2xs font-medium text-muted-foreground">{t(`kinds.${kind}`)}</h4>
            <ul className="space-y-1">
              {group.map((style) => (
                <StyleRow key={style.id} style={style} onRefused={setRefused} />
              ))}
            </ul>
          </div>
        );
      })}
    </InspectorSection>
  );
}
