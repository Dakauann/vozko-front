"use client";

import { useFormatter, useTranslations } from "next-intl";

import type { Clip, Track, VideoDocument } from "@/lib/studio/document";
import { localTime } from "@/lib/studio/keyframe-edit";
import { sharedValue } from "@/lib/studio/selection-edit";
import { freshVfx, keyedParams, listensToTrack, paramSpec, refusedOnEffectClips, VFX_KINDS, vfxColor, vfxColors, vfxKeyState, vfxParams, vfxValue, type Vfx, type VfxKind, type VfxParam } from "@/lib/studio/vfx";
import { addClipVfx, moveClipVfx, removeClipVfx, timelineOf, toggleClipVfxKey, updateClipVfx, vfxSelectionEdit, withDefaultTrack, type VfxEdit, type VfxPatch } from "@/lib/studio/vfx-edit";

import { EffectTiles } from "../../vfx/effect-tiles";
import { sliderStep, useOpenVfx, VfxActions, VfxRows } from "../../vfx/vfx-stack";
import { useEditorState, usePanelPlayhead } from "../editor-context";
import { useTrackNames } from "../use-track-names";
import { ColorField, InspectorSection, SelectField, SliderField } from "./fields";
import { KeyToggle } from "./key-toggle";
import type { SelectionEditor } from "./use-selection-editor";

const PERCENT = 100;

interface VfxFieldsProps {
  clip: Clip;
  disabled: boolean;
  editor: SelectionEditor;
}

export function VfxFields({ clip, disabled, editor }: VfxFieldsProps) {
  const t = useTranslations("studio.video.vfx");
  const playheadMs = usePanelPlayhead();
  const list = clip.vfx ?? [];
  const { open, openIndex, setOpenId } = useOpenVfx(list);
  const localMs = localTime(clip, playheadMs);
  const doc = useEditorState((state) => state.document);
  const soundTracks = (timelineOf(doc, clip.id) ?? doc).tracks.filter((track) => track.kind === "audio");
  const run = (edit: (doc: VideoDocument) => VfxEdit) => editor.run((doc) => vfxSelectionEdit(edit(doc)));

  const add = (kind: VfxKind) => {
    const vfx = freshVfx(kind);
    if (run((current) => addClipVfx(current, clip.id, withDefaultTrack(vfx, timelineOf(current, clip.id))))) setOpenId(vfx.id);
  };
  const unavailable = (kind: VfxKind) => (listensToTrack(kind) && soundTracks.length === 0 ? t("needsSound") : clip.type === "effect" && refusedOnEffectClips(kind) ? t("notOnEffectClips") : null);

  return (
    <InspectorSection title={t("title")}>
      <p className="text-2xs font-medium text-muted-foreground">{t("add")}</p>
      <EffectTiles
        kinds={VFX_KINDS}
        label={t("add")}
        tileLabel={(kind) => t("addKind", { kind: t(`kinds.${kind}`) })}
        hint={(kind) => t(`hints.${kind}`)}
        side="left"
        disabled={disabled}
        unavailable={unavailable}
        onPick={add}
      />
      {list.length === 0 ? (
        <p className="text-2xs text-muted-foreground">{clip.type === "effect" ? t("emptyEffectClip") : t("empty")}</p>
      ) : (
        <VfxRows list={list} open={open} label={t("list")} onOpen={setOpenId} />
      )}
      {open ? (
        <VfxDetail
          key={open.id}
          vfx={open}
          disabled={disabled}
          localMs={localMs}
          editor={editor}
          soundTracks={soundTracks}
          canMoveUp={openIndex > 0}
          canMoveDown={openIndex < list.length - 1}
          onPatch={(patch) => run((doc) => updateClipVfx(doc, clip.id, open.id, patch, localMs))}
          onToggleKey={(name) => {
            if (localMs !== null) run((doc) => toggleClipVfxKey(doc, clip.id, open.id, name, localMs));
          }}
          onMove={(delta) => run((doc) => moveClipVfx(doc, clip.id, open.id, openIndex + delta))}
          onRemove={() => {
            if (run((doc) => removeClipVfx(doc, clip.id, open.id))) setOpenId(null);
          }}
        />
      ) : null}
    </InspectorSection>
  );
}

interface VfxDetailProps {
  vfx: Vfx;
  disabled: boolean;
  localMs: number | null;
  editor: SelectionEditor;
  soundTracks: readonly Track[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onPatch: (patch: VfxPatch) => boolean;
  onToggleKey: (name: VfxParam) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}

function VfxDetail({ vfx, disabled, localMs, editor, soundTracks, canMoveUp, canMoveDown, onPatch, onToggleKey, onMove, onRemove }: VfxDetailProps) {
  const t = useTranslations("studio.video.vfx");
  const format = useFormatter();
  const names = useTrackNames(soundTracks);
  const params = vfxParams(vfx.kind);
  const keyed = keyedParams(vfx.kind);

  const field = (name: VfxParam) => {
    const spec = paramSpec(vfx.kind, name)!;
    const { step, decimals } = sliderStep(spec.range);
    const value = vfxValue(vfx, name, localMs ?? 0);
    const label = t(`params.${name}`);
    const state = vfxKeyState(vfx, name, localMs);
    return (
      <div key={name} className="flex items-end gap-1">
        <div className="min-w-0 flex-1">
          <SliderField
            label={label}
            value={value}
            fallback={spec.fallback}
            min={spec.range[0]}
            max={spec.range[1]}
            step={step}
            valueText={format.number(value, { maximumFractionDigits: decimals })}
            disabled={disabled}
            keyState={spec.keyed ? state : "static"}
            keyHint={spec.keyed ? (state === "key" ? t("keyHint") : t("interpolatedHint")) : undefined}
            onStart={editor.gesture.onStart}
            onCommit={editor.gesture.onCommit}
            onChange={(next) => onPatch({ params: { [name]: next } })}
          />
        </div>
        {spec.keyed ? <KeyToggle label={t("key", { field: label })} state={state} disabled={disabled || localMs === null} onClick={() => onToggleKey(name)} /> : null}
      </div>
    );
  };

  return (
    <div role="group" aria-label={t("detail")} className="space-y-2 rounded-md border border-border p-2">
      <VfxActions vfx={vfx} disabled={disabled} canMoveUp={canMoveUp} canMoveDown={canMoveDown} onPatch={onPatch} onMove={onMove} onRemove={onRemove} />
      {listensToTrack(vfx.kind) ? (
        <SelectField<string>
          label={t("soundTrack")}
          value={vfx.trackId ?? null}
          options={soundTracks.map((track) => ({ value: track.id, label: names.get(track.id) ?? track.id }))}
          disabled={disabled}
          onChange={(trackId) => onPatch({ trackId })}
        />
      ) : null}
      {vfxColors(vfx.kind).map((name) => (
        <ColorField key={name} label={t(`colors.${name}`)} value={vfxColor(vfx, name)} opaque disabled={disabled} onChange={(color) => onPatch({ colors: { [name]: color } })} />
      ))}
      {params.map(field)}
      {localMs === null && keyed.length > 0 ? <p className="text-2xs text-muted-foreground">{t("outsideHint")}</p> : null}
      {keyed.length < params.length ? <p className="text-2xs text-muted-foreground">{t("pacedHint")}</p> : null}
    </div>
  );
}

interface EffectStrengthFieldsProps {
  clips: readonly Clip[];
  disabled: boolean;
  editor: SelectionEditor;
}

export function EffectStrengthFields({ clips, disabled, editor }: EffectStrengthFieldsProps) {
  const t = useTranslations("studio.video.vfx");
  const format = useFormatter();
  const shared = sharedValue(clips, (clip) => Math.round(clip.transform.opacity * PERCENT));
  const value = shared.kind === "same" ? shared.value : null;
  return (
    <InspectorSection title={t("strengthTitle")}>
      <SliderField
        label={t("strength")}
        min={0}
        max={PERCENT}
        step={1}
        value={value}
        fallback={PERCENT}
        valueText={format.number((value ?? 0) / PERCENT, { style: "percent" })}
        disabled={disabled}
        onStart={editor.gesture.onStart}
        onCommit={editor.gesture.onCommit}
        onChange={(next) => editor.patch((clip) => ({ transform: { ...clip.transform, opacity: next / PERCENT } }))}
      />
      <p className="text-2xs text-muted-foreground">{t("strengthHint")}</p>
    </InspectorSection>
  );
}
