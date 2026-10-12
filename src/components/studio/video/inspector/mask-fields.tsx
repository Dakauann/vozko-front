"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ArrowDown, ArrowUp, Trash } from "@/components/icons";
import { newStudioId, type Clip, type VideoDocument } from "@/lib/studio/document";
import { localTime } from "@/lib/studio/keyframe-edit";
import { addClipMask, maskSelectionEdit, moveClipMask, removeClipMask, setClipMaskPathVertex, toggleClipMaskKey, toggleClipMaskPathKey, updateClipMask, type MaskEdit, type MaskPatch } from "@/lib/studio/mask-edit";
import { MASK_MODES, MASK_POINTS_RANGE, MASK_RANGES, MASK_SHAPES, maskKeyState, maskPathAt, maskPathKeyState, maskProperties, maskValue, newMask, type Mask, type MaskProperty, type MaskShape } from "@/lib/studio/masks";
import type { VertexPin } from "@/lib/studio/morph-keys";
import { changedMatte, MATTE_CHANNELS, matteOf, mattePatch, type MatteChange, type MatteChannel } from "@/lib/studio/matte";
import { cn } from "@/lib/utils";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import Button from "@/components/elevated-design/button";

import { usePanelPlayhead, useVideoEditor, useViewState } from "../editor-context";
import { PathKeyList } from "./path-key-list";
import { ToolButton } from "../tool-button";
import { KeyedField } from "./key-toggle";
import { CodeField } from "./code-field";
import { FieldGrid, InspectorSection, NumberField, SelectField, ToggleField } from "./fields";
import type { SelectionEditor } from "./use-selection-editor";

const PERCENT = 100;
const DEGREES: ReadonlySet<MaskProperty> = new Set(["rotation"]);

const GLYPHS: Record<MaskShape, ReactNode> = {
  rectangle: <rect x="2.5" y="3.5" width="11" height="9" rx="1" />,
  ellipse: <ellipse cx="8" cy="8" rx="5.5" ry="4.5" />,
  linear: <path d="M2.5 2.5h5.5v11H2.5z" />,
  mirror: <path d="M2.5 6h11v4h-11z" />,
  star: <path d="M8 2l1.8 3.9 4.2.4-3.2 2.8 1 4.1L8 11.1 4.2 13.2l1-4.1L2 6.3l4.2-.4z" />,
  heart: <path d="M8 13.5S2.5 10 2.5 6.2A2.8 2.8 0 0 1 8 5a2.8 2.8 0 0 1 5.5 1.2C13.5 10 8 13.5 8 13.5z" />,
  triangle: <path d="M8 2.5l5.5 11h-11z" />,
  path: <path d="M3 12.5C3 6 8 2.5 13 5l-2 8z" />,
};

function scaleOf(property: MaskProperty): number {
  return DEGREES.has(property) ? 1 : PERCENT;
}

function ShapeGlyph({ shape }: { shape: MaskShape }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 fill-current">
      {GLYPHS[shape]}
    </svg>
  );
}

interface MaskFieldsProps {
  clip: Clip;
  disabled: boolean;
  editor: SelectionEditor;
}

export function MaskFields({ clip, disabled, editor }: MaskFieldsProps) {
  const t = useTranslations("studio.video.masks");
  const playheadMs = usePanelPlayhead();
  const [openId, setOpenId] = useState<string | null>(null);
  const masks = clip.masks ?? [];
  const open = masks.find((mask) => mask.id === openId) ?? masks.at(-1) ?? null;
  const openIndex = open ? masks.indexOf(open) : -1;
  const localMs = localTime(clip, playheadMs);
  const run = (edit: (doc: VideoDocument) => MaskEdit) => editor.run((doc) => maskSelectionEdit(edit(doc)));
  const { playback, view } = useVideoEditor();
  const editingMask = useViewState((s) => (s.pathEdit?.clipId === clip.id ? (s.pathEdit.maskId ?? null) : null));

  const add = (shape: MaskShape) => {
    const mask = newMask(shape, newStudioId("mask"));
    if (run((doc) => addClipMask(doc, clip.id, mask))) setOpenId(mask.id);
  };

  return (
    <InspectorSection title={t("title")}>
      <div role="group" aria-label={t("add")} className="flex flex-wrap items-center gap-0.5">
        {MASK_SHAPES.map((shape) => (
          <ToolButton key={shape} size="sm" label={t("addShape", { shape: t(`shapes.${shape}`) })} icon={<ShapeGlyph shape={shape} />} disabled={disabled} onClick={() => add(shape)} />
        ))}
      </div>
      {masks.length === 0 ? (
        <p className="text-2xs text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-0.5" aria-label={t("list")}>
          {masks.map((mask, index) => (
            <li key={mask.id}>
              <button
                type="button"
                aria-pressed={mask === open}
                onClick={() => setOpenId(mask.id)}
                className={cn(
                  "flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  mask === open ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <ShapeGlyph shape={mask.shape} />
                <span className="min-w-0 flex-1 truncate">{t("mask", { index: index + 1, shape: t(`shapes.${mask.shape}`) })}</span>
                <span className="text-2xs text-muted-foreground">{t(`modes.${mask.mode}`)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <MaskDetail
          key={open.id}
          mask={open}
          disabled={disabled}
          localMs={localMs}
          editor={editor}
          canMoveUp={openIndex > 0}
          canMoveDown={openIndex < masks.length - 1}
          onPatch={(patch) => run((doc) => updateClipMask(doc, clip.id, open.id, patch, localMs))}
          onToggleKey={(property) => {
            if (localMs !== null) run((doc) => toggleClipMaskKey(doc, clip.id, open.id, property, localMs));
          }}
          path={{
            editing: editingMask === open.id,
            onEdit: () => view.setState({ pathEdit: editingMask === open.id ? null : { clipId: clip.id, maskId: open.id } }),
            onToggleKey: () => {
              if (localMs !== null) run((doc) => toggleClipMaskPathKey(doc, clip.id, open.id, localMs));
            },
            onSeek: (atMs) => playback.seek(clip.startMs + atMs),
            onVertex: (atMs, pin) => run((doc) => setClipMaskPathVertex(doc, clip.id, open.id, atMs, pin)),
            onRemoveKey: (atMs) => run((doc) => toggleClipMaskPathKey(doc, clip.id, open.id, atMs)),
            startMs: clip.startMs,
          }}
          onMove={(delta) => run((doc) => moveClipMask(doc, clip.id, open.id, openIndex + delta))}
          onRemove={() => {
            if (run((doc) => removeClipMask(doc, clip.id, open.id))) setOpenId(null);
          }}
        />
      ) : null}
      {clip.type === "effect" ? <p className="text-2xs text-muted-foreground">{t("effectHint")}</p> : <MatteFields clip={clip} disabled={disabled} editor={editor} />}
    </InspectorSection>
  );
}

function MatteFields({ clip, disabled, editor }: MaskFieldsProps) {
  const t = useTranslations("studio.video.masks");
  const matte = matteOf(clip);
  const change = (next: MatteChange) => editor.patch((current) => mattePatch(changedMatte(matteOf(current), next)));
  return (
    <div className="space-y-2">
      <ToggleField label={t("matte")} checked={Boolean(matte)} disabled={disabled} onChange={(on) => change({ on })} />
      <p className="text-2xs text-muted-foreground">{t("matteHint")}</p>
      {matte ? (
        <>
          <div className="space-y-1">
            <span className="block text-2xs text-muted-foreground">{t("matteChannel")}</span>
            <ElevatedPillToggle<MatteChannel>
              aria-label={t("matteChannel")}
              value={matte.channel}
              onChange={(channel) => {
                if (!disabled) change({ channel });
              }}
              className="flex w-full [&>button]:flex-1"
              options={MATTE_CHANNELS.map((channel) => ({ value: channel, label: t(`matteChannels.${channel}`), disabled }))}
            />
          </div>
          <ToggleField label={t("matteInvert")} checked={matte.invert} disabled={disabled} onChange={(invert) => change({ invert })} />
          {matte.channel === "luma" ? <p className="text-2xs text-muted-foreground">{t("matteLumaHint")}</p> : null}
          {matte.invert ? <p className="text-2xs text-muted-foreground">{t("matteInvertHint")}</p> : null}
        </>
      ) : null}
    </div>
  );
}

interface MaskPathActions {
  editing: boolean;
  startMs: number;
  onEdit: () => void;
  onToggleKey: () => void;
  onSeek: (atMs: number) => void;
  onVertex: (atMs: number, pin: VertexPin | null) => void;
  onRemoveKey: (atMs: number) => void;
}

interface MaskDetailProps {
  mask: Mask;
  path: MaskPathActions;
  disabled: boolean;
  localMs: number | null;
  editor: SelectionEditor;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onPatch: (patch: MaskPatch) => boolean;
  onToggleKey: (property: MaskProperty) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}

function MaskPathFields({ mask, disabled, localMs, path, onPatch }: Pick<MaskDetailProps, "mask" | "disabled" | "localMs" | "path" | "onPatch">) {
  const t = useTranslations("studio.video.masks");
  const tm = useTranslations("studio.video.morph");
  return (
    <div className="space-y-2">
      <KeyedField toggle={{ label: t("key", { field: t("fields.path") }), state: maskPathKeyState(mask, localMs), disabled: disabled || localMs === null, onClick: path.onToggleKey }}>
        <CodeField label={t("fields.path")} hint={t("pathHint")} value={maskPathAt(mask, localMs ?? 0)} disabled={disabled} onCommit={(value) => onPatch({ path: value })} />
      </KeyedField>
      <Button variant={path.editing ? "primary" : "outline"} size="sm" title={path.editing ? tm("done") : tm("edit")} disabled={disabled} aria-pressed={path.editing} onClick={path.onEdit} />
      {(mask.keyframes?.path?.length ?? 0) > 0 ? (
        <PathKeyList keys={mask.keyframes!.path!} startMs={path.startMs} localMs={localMs} disabled={disabled} onSeek={path.onSeek} onVertex={path.onVertex} onRemove={path.onRemoveKey} />
      ) : null}
    </div>
  );
}

function MaskDetail({ mask, path, disabled, localMs, editor, canMoveUp, canMoveDown, onPatch, onToggleKey, onMove, onRemove }: MaskDetailProps) {
  const t = useTranslations("studio.video.masks");
  const field = (property: MaskProperty) => {
    const scale = scaleOf(property);
    const [min, max] = MASK_RANGES[property];
    const state = maskKeyState(mask, property, localMs);
    const label = t(`fields.${property}`);
    return (
      <KeyedField key={property} toggle={{ label: t("key", { field: label }), state, disabled: disabled || localMs === null, onClick: () => onToggleKey(property) }}>
        <NumberField
          label={label}
          value={maskValue(mask, property, localMs ?? 0) * scale}
          unit={scale === PERCENT ? "%" : "°"}
          decimals={1}
          min={min * scale}
          max={max * scale}
          disabled={disabled}
          keyState={state}
          keyHint={state === "key" ? t("keyHint") : t("interpolatedHint")}
          onGestureStart={editor.gesture.onStart}
          onGestureEnd={editor.gesture.onCommit}
          onCommit={(value) => onPatch({ [property]: value / scale })}
        />
      </KeyedField>
    );
  };
  return (
    <div role="group" aria-label={t("detail")} className="space-y-2 rounded-md border border-border p-2">
      <div className="flex items-center justify-end gap-0.5">
        <ToolButton size="sm" label={t("moveUp")} icon={<ArrowUp className="h-3.5 w-3.5" />} disabled={disabled || !canMoveUp} onClick={() => onMove(-1)} />
        <ToolButton size="sm" label={t("moveDown")} icon={<ArrowDown className="h-3.5 w-3.5" />} disabled={disabled || !canMoveDown} onClick={() => onMove(1)} />
        <ToolButton size="sm" label={t("remove")} icon={<Trash className="h-3.5 w-3.5" />} disabled={disabled} onClick={onRemove} />
      </div>
      <FieldGrid>
        <SelectField label={t("shape")} value={mask.shape} disabled={disabled} options={MASK_SHAPES.map((shape) => ({ value: shape, label: t(`shapes.${shape}`) }))} onChange={(shape) => onPatch({ shape })} />
        <SelectField label={t("mode")} value={mask.mode} disabled={disabled} options={MASK_MODES.map((mode) => ({ value: mode, label: t(`modes.${mode}`) }))} onChange={(mode) => onPatch({ mode })} />
      </FieldGrid>
      <ToggleField label={t("invert")} checked={Boolean(mask.invert)} disabled={disabled} onChange={(invert) => onPatch({ invert })} />
      {mask.shape === "star" ? (
        <NumberField label={t("fields.points")} value={mask.points ?? null} min={MASK_POINTS_RANGE[0]} max={MASK_POINTS_RANGE[1]} disabled={disabled} onCommit={(points) => onPatch({ points: Math.round(points) })} />
      ) : null}
      {mask.shape === "path" ? <MaskPathFields mask={mask} disabled={disabled} localMs={localMs} path={path} onPatch={onPatch} /> : null}
      <div className="grid grid-cols-2 gap-2">{maskProperties(mask.shape).map(field)}</div>
      {localMs === null ? <p className="text-2xs text-muted-foreground">{t("outsideHint")}</p> : null}
    </div>
  );
}
