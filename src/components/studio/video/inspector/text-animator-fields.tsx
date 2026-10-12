"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { ArrowDown, ArrowUp, Plus, Shuffle, Trash, X } from "@/components/icons";
import { shownText } from "@/lib/studio/counter";
import { videoCanvasSize, type Clip, type Layer, type VideoDocument } from "@/lib/studio/document";
import { localTime } from "@/lib/studio/keyframe-edit";
import { TEXT_UNITS, textUnitFrames, type LaidLine, type TextUnit } from "@/lib/studio/text-animation";
import {
  fontPxOf,
  newTextUnitAnimator,
  offeredProperties,
  presetFits,
  PROPERTY_STARTS,
  selectorKeyState,
  TEXT_ANIMATOR_PRESETS,
  TEXT_ANIMATOR_SEED_RANGE,
  textAnimatorPreset,
  unitsInText,
  type TextAnimatorPreset,
} from "@/lib/studio/text-animator";
import {
  addClipTextAnimator,
  moveClipTextAnimator,
  removeClipTextAnimator,
  textAnimatorSelectionEdit,
  toggleClipTextAnimatorKey,
  updateClipTextAnimator,
  type TextAnimatorEdit,
  type TextAnimatorPatch,
} from "@/lib/studio/text-animator-edit";
import {
  animatorFrameAt,
  ANIMATOR_NUMBER_RANGES,
  RANGE_LIMITS,
  RANGE_ORDERS,
  RANGE_SHAPES,
  RANGE_UNITS,
  rangeWindow,
  SELECTOR_KINDS,
  selectorAmounts,
  selectorKeyRange,
  selectorValue,
  WIGGLY_LIMITS,
  type AnimatorColor,
  type AnimatorNumber,
  type SelectorKey,
  type TextUnitAnimator,
} from "@/lib/studio/text-selectors";
import { randomSeed } from "@/lib/studio/vfx";
import { cn } from "@/lib/utils";

import { useEditorState, usePanelPlayhead } from "../editor-context";
import { ToolButton } from "../tool-button";
import { ColorField, FieldGrid, InspectorSection, NumberField, SelectField, SliderField } from "./fields";
import { KeyToggle } from "./key-toggle";
import type { SelectionEditor } from "./use-selection-editor";

const MS = 1000;
const SAMPLE_TEXT = "Abc de";
const SAMPLE_MS = 1600;
const SAMPLE_REST = 0.7;
const SAMPLE_CELL = 9;
const SAMPLE_HEIGHT = 18;
const SAMPLE_LAYER: Layer = { id: "sample", type: "text", transform: { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 }, text: SAMPLE_TEXT, fill: "#ffffff" };
const SAMPLE_LINES: LaidLine[] = [{ top: 2, height: SAMPLE_HEIGHT - 4, chars: [...SAMPLE_TEXT].map((char, i) => ({ char, left: i * SAMPLE_CELL, right: (i + 1) * SAMPLE_CELL })) }];
const SAMPLE_WIDTH = SAMPLE_TEXT.length * SAMPLE_CELL;
const VISUAL_HEIGHT = 36;
const LETTER_CUT = animatorFrameAt(newTextUnitAnimator("char", {}), 0);
const NUMBER_UNITS: Record<AnimatorNumber, string> = { x: "px", y: "px", scale: "%", rotation: "°", rotationX: "°", rotationY: "°", opacity: "%", blur: "px", tracking: "px" };
const SAMPLE_LENS_PX = 60;

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

function SampleText({ animator, atMs }: { animator: TextUnitAnimator; atMs: number }) {
  const frames = textUnitFrames({ animators: [animatorFrameAt(animator, atMs), LETTER_CUT], localMs: atMs, durationMs: SAMPLE_MS }, SAMPLE_LINES, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  const tint = animator.properties.fill;
  return (
    <span aria-hidden className="relative mx-auto block" style={{ width: SAMPLE_WIDTH, height: SAMPLE_HEIGHT }}>
      {frames.map(({ tile, look }, i) => {
        const shown = [...SAMPLE_TEXT].filter((char) => char !== " ")[i] ?? "";
        const share = Math.round((look.tints?.[0] ?? 0) * 100);
        return (
          <span
            key={i}
            className="absolute flex items-center justify-center text-[11px] font-semibold leading-none text-foreground"
            style={{
              left: tile.x,
              top: 0,
              width: tile.width,
              height: SAMPLE_HEIGHT,
              opacity: look.opacity,
              filter: look.blurPx > 0 ? `blur(${look.blurPx / 4}px)` : undefined,
              transform: `perspective(${SAMPLE_LENS_PX}px) translate3d(${look.dx / 4}px, ${look.dy / 4}px, ${-look.depth / 4}px) rotateX(${look.rotationX}deg) rotateY(${look.rotationY}deg) rotate(${look.rotation}deg) scale(${look.scale})`,
              color: tint && share > 0 ? `color-mix(in srgb, currentColor ${100 - share}%, ${tint} ${share}%)` : undefined,
            }}
          >
            {shown}
          </span>
        );
      })}
    </span>
  );
}

function PresetThumb({ animator, playing }: { animator: TextUnitAnimator; playing: boolean }) {
  const [atMs, setAtMs] = useState(SAMPLE_MS * SAMPLE_REST);
  const frame = useRef<number | null>(null);
  const animating = playing && !reducedMotion();
  useEffect(() => {
    if (!animating) return;
    const started = performance.now();
    const tick = (now: number) => {
      setAtMs((now - started) % SAMPLE_MS);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [animating]);
  return (
    <span className="flex h-8 w-full items-center overflow-hidden rounded-sm border border-border bg-muted">
      <SampleText animator={animator} atMs={animating ? atMs : SAMPLE_MS * SAMPLE_REST} />
    </span>
  );
}

const SAMPLES = Object.fromEntries(TEXT_ANIMATOR_PRESETS.map((id) => [id, textAnimatorPreset(id, { durationMs: SAMPLE_MS, fontPx: SAMPLE_HEIGHT * 4, layer: SAMPLE_LAYER }, 1)!])) as Record<TextAnimatorPreset, TextUnitAnimator>;

function PresetGallery({ layer, disabled, onApply }: { layer: Layer; disabled: boolean; onApply: (id: TextAnimatorPreset) => void }) {
  const t = useTranslations("studio.video.textAnimators");
  const [hovered, setHovered] = useState<TextAnimatorPreset | null>(null);
  return (
    <div className="space-y-1">
      <span className="block text-2xs text-muted-foreground">{t("presetsTitle")}</span>
      <div role="group" aria-label={t("presetsTitle")} className="grid grid-cols-3 gap-1">
        {TEXT_ANIMATOR_PRESETS.map((id) => (
          <button
            key={id}
            type="button"
            disabled={disabled || !presetFits(id, layer)}
            title={t("presetApply", { name: t(`presets.${id}`) })}
            onPointerEnter={() => setHovered(id)}
            onPointerLeave={() => setHovered((current) => (current === id ? null : current))}
            onFocus={() => setHovered(id)}
            onBlur={() => setHovered((current) => (current === id ? null : current))}
            onClick={() => onApply(id)}
            className={cn(
              "flex min-w-0 flex-col gap-1 rounded-[--radius] border border-border bg-card p-1 text-left text-[10px] leading-tight text-foreground transition-colors",
              "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            <PresetThumb animator={SAMPLES[id]} playing={hovered === id} />
            <span className="line-clamp-2 block min-h-[2lh] break-words">{t(`presets.${id}`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectionVisual({ animator, localMs, count }: { animator: TextUnitAnimator; localMs: number; count: number }) {
  const t = useTranslations("studio.video.textAnimators");
  const units = Math.max(1, count);
  const frame = animatorFrameAt(animator, localMs).selector;
  const amounts = selectorAmounts(frame, units);
  const values = Array.from({ length: units }, (_, i) => amounts(0, i));
  const signed = values.some((value) => value < 0);
  const base = signed ? VISUAL_HEIGHT / 2 : VISUAL_HEIGHT;
  const reach = signed ? VISUAL_HEIGHT / 2 : VISUAL_HEIGHT;
  const window = frame.kind === "range" ? rangeWindow(frame, units) : null;
  const gap = units > 40 ? 0 : 0.15;
  return (
    <svg role="img" aria-label={t("visualLabel", { count: units })} viewBox={`0 0 ${units} ${VISUAL_HEIGHT + 4}`} preserveAspectRatio="none" className="h-12 w-full rounded-sm border border-border bg-muted text-primary">
      {window ? <rect x={Math.max(0, window[0]) * units} y={VISUAL_HEIGHT + 1} width={Math.max(0, Math.min(1, window[1]) - Math.max(0, window[0])) * units} height={3} className="fill-muted-foreground/60" /> : null}
      {values.map((value, i) => {
        const height = Math.abs(value) * reach;
        return <rect key={i} x={i + gap / 2} width={1 - gap} y={value >= 0 ? base - height : base} height={height} className="fill-current" />;
      })}
      {signed ? <line x1={0} x2={units} y1={base} y2={base} className="stroke-border" strokeWidth={0.5} vectorEffect="non-scaling-stroke" /> : null}
    </svg>
  );
}

interface TextAnimatorFieldsProps {
  clip: Clip;
  disabled: boolean;
  editor: SelectionEditor;
}

export function TextAnimatorFields({ clip, disabled, editor }: TextAnimatorFieldsProps) {
  const t = useTranslations("studio.video.textAnimators");
  const playheadMs = usePanelPlayhead();
  const canvasHeight = useEditorState((state) => videoCanvasSize(state.document).height);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = clip.textAnimators ?? [];
  const open = list.find((animator) => animator.id === openId) ?? list.at(-1) ?? null;
  const openIndex = open ? list.indexOf(open) : -1;
  const localMs = localTime(clip, playheadMs);
  const layer = clip.layer!;
  const run = (edit: (doc: VideoDocument) => TextAnimatorEdit) => editor.run((doc) => textAnimatorSelectionEdit(edit(doc)));

  const add = (animator: TextUnitAnimator | null) => {
    if (animator && run((doc) => addClipTextAnimator(doc, clip.id, animator))) setOpenId(animator.id);
  };

  return (
    <InspectorSection id="textAnimators" title={t("title")}>
      <PresetGallery layer={layer} disabled={disabled} onApply={(id) => add(textAnimatorPreset(id, { durationMs: clip.durationMs, fontPx: fontPxOf(layer, canvasHeight), layer }))} />
      <ToolButton size="sm" showLabel label={t("addCustom")} icon={<Plus className="h-3.5 w-3.5" />} disabled={disabled} onClick={() => add(newTextUnitAnimator("char", { opacity: PROPERTY_STARTS.opacity }))} />
      {list.length === 0 ? (
        <p className="text-2xs text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-0.5" aria-label={t("list")}>
          {list.map((animator, index) => (
            <li key={animator.id}>
              <button
                type="button"
                aria-pressed={animator === open}
                onClick={() => setOpenId(animator.id)}
                className={cn(
                  "flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  animator === open ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{t("item", { index: index + 1, unit: t(`units.${animator.unit}`), selector: t(`kinds.${animator.selector.kind}`) })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <AnimatorDetail
          key={open.id}
          animator={open}
          layer={layer}
          count={unitsInText(shownText(clip), open.unit)}
          disabled={disabled}
          localMs={localMs}
          editor={editor}
          canMoveUp={openIndex > 0}
          canMoveDown={openIndex < list.length - 1}
          onPatch={(patch) => run((doc) => updateClipTextAnimator(doc, clip.id, open.id, patch, localMs))}
          onToggleKey={(key) => {
            if (localMs !== null) run((doc) => toggleClipTextAnimatorKey(doc, clip.id, open.id, key, localMs));
          }}
          onMove={(delta) => run((doc) => moveClipTextAnimator(doc, clip.id, open.id, openIndex + delta))}
          onRemove={() => {
            if (run((doc) => removeClipTextAnimator(doc, clip.id, open.id))) setOpenId(null);
          }}
        />
      ) : null}
      <p className="text-2xs text-muted-foreground">{t("hint")}</p>
    </InspectorSection>
  );
}

interface AnimatorDetailProps {
  animator: TextUnitAnimator;
  layer: Layer;
  count: number;
  disabled: boolean;
  localMs: number | null;
  editor: SelectionEditor;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onPatch: (patch: TextAnimatorPatch) => boolean;
  onToggleKey: (key: SelectorKey) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}

function AnimatorDetail({ animator, layer, count, disabled, localMs, editor, canMoveUp, canMoveDown, onPatch, onToggleKey, onMove, onRemove }: AnimatorDetailProps) {
  const t = useTranslations("studio.video.textAnimators");
  const format = useFormatter();
  const selector = animator.selector;
  const at = localMs ?? 0;
  const present = [...Object.keys(animator.properties)] as (AnimatorNumber | AnimatorColor)[];
  const offered = offeredProperties(animator, layer);

  const keyedSlider = (key: SelectorKey, step: number) => {
    const range = selectorKeyRange(selector, key)!;
    const value = selectorValue(animator, key, at);
    const state = selectorKeyState(animator, key, localMs);
    const label = t(`fields.${key}`);
    return (
      <div key={key} className="flex items-end gap-1">
        <div className="min-w-0 flex-1">
          <SliderField
            label={label}
            value={value}
            fallback={key === "end" || key === "amount" ? range[1] : 0}
            min={range[0]}
            max={range[1]}
            step={step}
            valueText={format.number(value, { maximumFractionDigits: step < 1 ? 1 : 0 })}
            disabled={disabled}
            keyState={state}
            keyHint={state === "key" ? t("keyHint") : t("interpolatedHint")}
            onStart={editor.gesture.onStart}
            onCommit={editor.gesture.onCommit}
            onChange={(next) => onPatch({ keyed: { [key]: next } })}
          />
        </div>
        <KeyToggle label={t("key", { field: label })} state={state} disabled={disabled || localMs === null} onClick={() => onToggleKey(key)} />
      </div>
    );
  };

  const plainSlider = (field: "easeHigh" | "easeLow" | "correlation", range: readonly [number, number], value: number) => (
    <SliderField
      key={field}
      label={t(`fields.${field}`)}
      value={value}
      fallback={0}
      min={range[0]}
      max={range[1]}
      step={1}
      valueText={format.number(value)}
      disabled={disabled}
      onStart={editor.gesture.onStart}
      onCommit={editor.gesture.onCommit}
      onChange={(next) => onPatch({ [field]: next })}
    />
  );

  const propertyField = (name: AnimatorNumber | AnimatorColor) => {
    const remove = <ToolButton size="sm" label={t("removeProperty", { name: t(`properties.${name}`) })} icon={<X className="h-3 w-3" />} disabled={disabled} onClick={() => onPatch({ properties: { [name]: null } })} />;
    if (name === "fill" || name === "stroke") {
      return (
        <div key={name} className="flex items-end gap-1">
          <div className="min-w-0 flex-1">
            <ColorField label={t(`properties.${name}`)} value={animator.properties[name] ?? null} opaque disabled={disabled} onChange={(color) => onPatch({ properties: { [name]: color } })} />
          </div>
          {remove}
        </div>
      );
    }
    const range = ANIMATOR_NUMBER_RANGES[name];
    return (
      <div key={name} className="flex items-end gap-1">
        <div className="min-w-0 flex-1">
          <NumberField
            label={t(`properties.${name}`)}
            unit={NUMBER_UNITS[name]}
            min={range[0]}
            max={range[1]}
            decimals={1}
            value={animator.properties[name] ?? null}
            disabled={disabled}
            onCommit={(value) => onPatch({ properties: { [name]: value } })}
            onNudge={(delta) => onPatch({ properties: { [name]: Math.min(range[1], Math.max(range[0], (animator.properties[name] ?? 0) + delta)) } })}
            onGestureStart={editor.gesture.onStart}
            onGestureEnd={editor.gesture.onCommit}
          />
        </div>
        {remove}
      </div>
    );
  };

  return (
    <div role="group" aria-label={t("detail")} className="space-y-2 rounded-md border border-border p-2">
      <div className="flex items-center justify-end gap-0.5">
        <ToolButton size="sm" label={t("shuffle")} icon={<Shuffle className="h-3.5 w-3.5" />} disabled={disabled || (selector.kind === "range" && selector.order !== "random")} onClick={() => onPatch({ seed: randomSeed() })} />
        <ToolButton size="sm" label={t("moveUp")} icon={<ArrowUp className="h-3.5 w-3.5" />} disabled={disabled || !canMoveUp} onClick={() => onMove(-1)} />
        <ToolButton size="sm" label={t("moveDown")} icon={<ArrowDown className="h-3.5 w-3.5" />} disabled={disabled || !canMoveDown} onClick={() => onMove(1)} />
        <ToolButton size="sm" label={t("remove")} icon={<Trash className="h-3.5 w-3.5" />} disabled={disabled} onClick={onRemove} />
      </div>
      <FieldGrid>
        <SelectField<TextUnit> label={t("unit")} value={animator.unit} disabled={disabled} options={TEXT_UNITS.map((value) => ({ value, label: t(`units.${value}`) }))} onChange={(unit) => onPatch({ unit })} />
        <SelectField label={t("selector")} value={selector.kind} disabled={disabled} options={SELECTOR_KINDS.map((value) => ({ value, label: t(`kinds.${value}`) }))} onChange={(kind) => onPatch({ kind })} />
      </FieldGrid>
      <div className="space-y-1.5">
        <span className="block text-2xs font-medium text-muted-foreground">{t("propertiesTitle")}</span>
        {present.length === 0 ? <p className="text-2xs text-muted-foreground">{t("noProperties")}</p> : present.map(propertyField)}
        {offered.length > 0 ? (
          <SelectField<AnimatorNumber | AnimatorColor>
            label={t("addProperty")}
            value={null}
            disabled={disabled}
            options={offered.map((value) => ({ value, label: t(`properties.${value}`) }))}
            onChange={(name) => onPatch({ properties: { [name]: PROPERTY_STARTS[name] } })}
          />
        ) : null}
      </div>
      <SelectionVisual animator={animator} localMs={at} count={count} />
      {selector.kind === "range" ? (
        <div className="space-y-1.5">
          <FieldGrid>
            <SelectField label={t("fields.units")} value={selector.units} disabled={disabled} options={RANGE_UNITS.map((value) => ({ value, label: t(`rangeUnits.${value}`) }))} onChange={(units) => onPatch({ units })} />
            <SelectField label={t("fields.order")} value={selector.order} disabled={disabled} options={RANGE_ORDERS.map((value) => ({ value, label: t(`orders.${value}`) }))} onChange={(order) => onPatch({ order })} />
          </FieldGrid>
          <SelectField label={t("fields.shape")} value={selector.shape} disabled={disabled} options={RANGE_SHAPES.map((value) => ({ value, label: t(`shapes.${value}`) }))} onChange={(shape) => onPatch({ shape })} />
          {keyedSlider("start", 1)}
          {keyedSlider("end", 1)}
          {keyedSlider("offset", 1)}
          {keyedSlider("amount", 1)}
          {plainSlider("easeHigh", RANGE_LIMITS.ease, selector.easeHigh)}
          {plainSlider("easeLow", RANGE_LIMITS.ease, selector.easeLow)}
        </div>
      ) : (
        <div className="space-y-1.5">
          <FieldGrid>
            <NumberField
              label={t("fields.rate")}
              unit="Hz"
              step={0.1}
              decimals={1}
              min={WIGGLY_LIMITS.rate[0]}
              max={WIGGLY_LIMITS.rate[1]}
              value={selector.rate}
              disabled={disabled}
              onCommit={(rate) => onPatch({ rate })}
              onNudge={(delta) => onPatch({ rate: Math.min(WIGGLY_LIMITS.rate[1], Math.max(WIGGLY_LIMITS.rate[0], Math.round((selector.rate + delta) * 10) / 10)) })}
            />
            <NumberField
              label={t("fields.loopMs")}
              unit="s"
              step={0.1}
              decimals={2}
              min={WIGGLY_LIMITS.loopMs[0] / MS}
              max={WIGGLY_LIMITS.loopMs[1] / MS}
              value={selector.loopMs / MS}
              disabled={disabled}
              onCommit={(seconds) => onPatch({ loopMs: Math.round(seconds * MS) })}
              onNudge={(delta) => onPatch({ loopMs: Math.min(WIGGLY_LIMITS.loopMs[1], Math.max(WIGGLY_LIMITS.loopMs[0], Math.round(selector.loopMs + delta * MS))) })}
            />
          </FieldGrid>
          {plainSlider("correlation", WIGGLY_LIMITS.correlation, selector.correlation)}
          {keyedSlider("amount", 1)}
        </div>
      )}
      {selector.kind === "wiggly" || selector.order === "random" ? <p className="text-2xs text-muted-foreground">{t("seedHint", { seed: selector.seed, max: TEXT_ANIMATOR_SEED_RANGE[1] })}</p> : null}
      {localMs === null ? <p className="text-2xs text-muted-foreground">{t("outsideHint")}</p> : null}
    </div>
  );
}
