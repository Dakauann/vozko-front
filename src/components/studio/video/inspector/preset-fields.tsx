"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { DotsThreeVertical } from "@/components/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { applyAnimation, PRESET_LIMITS, PRESET_TIMINGS, presetDescription, presetName, presetPoseAt, presetPreviewClip, type AnimationPreset, type PresetTiming } from "@/lib/studio/animation-presets";
import type { Clip } from "@/lib/studio/document";
import { cn } from "@/lib/utils";

import { useVideoEditor } from "../editor-context";
import { presetLibrary, type SaveRefusal } from "../preset-library";
import { InspectorSection, SelectField } from "./fields";

const PREVIEW_PX = 56;

function usePresets() {
  const state = useSyncExternalStore(presetLibrary.store.subscribe, presetLibrary.store.getState, presetLibrary.store.getState);
  useEffect(() => {
    void presetLibrary.load();
  }, []);
  return state;
}

function PresetPreview({ preset }: { preset: AnimationPreset }) {
  const clip = useMemo(() => presetPreviewClip(preset.animation), [preset.animation]);
  const box = useRef<HTMLSpanElement>(null);
  const reduced = Boolean(useReducedMotion());
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const paint = (localMs: number) => {
      const pose = presetPoseAt(clip, localMs);
      element.style.left = `${pose.x * 100}%`;
      element.style.top = `${pose.y * 100}%`;
      element.style.width = `${pose.w * 100}%`;
      element.style.height = `${pose.h * 100}%`;
      element.style.opacity = String(Math.max(0, Math.min(1, pose.opacity)));
      element.style.transform = `translate(-50%, -50%) rotate(${pose.rotation}deg)`;
    };
    if (reduced) {
      paint(clip.durationMs / 2);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      paint((now - started) % clip.durationMs);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [clip, reduced]);
  return (
    <span aria-hidden className="relative block shrink-0 overflow-hidden rounded-[--radius] border border-border bg-muted" style={{ width: PREVIEW_PX, height: PREVIEW_PX }}>
      <span ref={box} className="absolute flex items-center justify-center rounded-[3px] bg-primary text-[10px] font-semibold text-primary-foreground">
        {preset.animation.scope === "text" ? "Aa" : null}
      </span>
    </span>
  );
}

function PresetTile({ preset, clips, timing, disabled, onOutcome }: { preset: AnimationPreset; clips: readonly Clip[]; timing: PresetTiming; disabled: boolean; onOutcome: (message: string, error: boolean) => void }) {
  const t = useTranslations("studio.video.presets");
  const locale = useLocale();
  const { store } = useVideoEditor();
  const [renaming, setRenaming] = useState(false);
  const name = presetName(preset, locale);
  const description = presetDescription(preset, locale);
  const apply = () => {
    const result = applyAnimation(store.getState().document, clips.map((clip) => clip.id), preset.animation, timing);
    if (!result.ok) return onOutcome(t(`applyRefusals.${result.reason}`), true);
    store.getState().apply(() => result.document);
    const skipped = Object.values(result.skipped).flat();
    onOutcome(skipped.length > 0 ? t("appliedWithout", { name, count: skipped.length }) : t("applied", { name }), false);
  };
  return (
    <li className="flex items-center gap-2 rounded-[--radius] border border-border p-1.5">
      <PresetPreview preset={preset} />
      <div className="min-w-0 flex-1">
        {renaming ? (
          <input
            autoFocus
            defaultValue={preset.name}
            maxLength={PRESET_LIMITS.nameRunes}
            aria-label={t("rename")}
            onBlur={(event) => {
              setRenaming(false);
              if (event.target.value.trim() !== preset.name) void presetLibrary.rename(preset.id, event.target.value).then((ok) => (ok ? null : onOutcome(t("renameFailed"), true)));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") setRenaming(false);
            }}
            className="h-6 w-full rounded-[--radius] border border-control-edge bg-card px-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        ) : (
          <p className="truncate text-xs font-medium text-foreground" title={description ?? name}>
            {name}
          </p>
        )}
        <p className="truncate text-2xs text-muted-foreground">{preset.builtIn ? t("builtIn") : (description ?? t("saved"))}</p>
      </div>
      <Button variant="outline" size="sm" title={t("apply")} disabled={disabled || clips.length === 0} onClick={apply} />
      {preset.builtIn ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={t("options", { name })} className="inline-flex h-6 w-6 items-center justify-center rounded-[--radius] text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <DotsThreeVertical className="h-3.5 w-3.5" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem className="text-xs" onSelect={() => setRenaming(true)}>
              {t("rename")}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs" onSelect={() => void presetLibrary.remove(preset.id).then((ok) => (ok ? null : onOutcome(t("removeFailed"), true)))}>
              {t("remove")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

function SavePreset({ clip, disabled, onOutcome }: { clip: Clip; disabled: boolean; onOutcome: (message: string, error: boolean) => void }) {
  const t = useTranslations("studio.video.presets");
  const { store } = useVideoEditor();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const result = await presetLibrary.save(store.getState().document, clip.id, name);
    setBusy(false);
    if (!result.ok) return onOutcome(t(`saveRefusals.${result.reason satisfies SaveRefusal}`), true);
    setName("");
    onOutcome(result.skipped.length > 0 ? t("savedWithout", { name: result.preset.name, count: result.skipped.length }) : t("savedAs", { name: result.preset.name }), false);
  };
  return (
    <form
      className="flex items-end gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <label className="min-w-0 flex-1 space-y-1">
        <span className="block text-2xs text-muted-foreground">{t("newName")}</span>
        <input
          value={name}
          maxLength={PRESET_LIMITS.nameRunes}
          disabled={disabled || busy}
          onChange={(event) => setName(event.target.value)}
          className="h-8 w-full rounded-[--radius] border border-control-edge bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
      </label>
      <Button type="submit" variant="outline" size="sm" title={busy ? t("saving") : t("save")} disabled={disabled || busy || name.trim() === ""} />
    </form>
  );
}

export function PresetFields({ clips, disabled }: { clips: readonly Clip[]; disabled: boolean }) {
  const t = useTranslations("studio.video.presets");
  const { status, presets } = usePresets();
  const [timing, setTiming] = useState<PresetTiming>("stretch");
  const [outcome, setOutcome] = useState<{ message: string; error: boolean } | null>(null);
  const report = (message: string, error: boolean) => setOutcome({ message, error });
  return (
    <InspectorSection id="presets" title={t("title")} summary={status === "ready" ? t("count", { count: presets.length }) : undefined}>
      {clips.length === 1 ? <SavePreset clip={clips[0]} disabled={disabled} onOutcome={report} /> : null}
      <SelectField<PresetTiming> label={t("timing")} value={timing} options={PRESET_TIMINGS.map((value) => ({ value, label: t(`timings.${value}`) }))} disabled={disabled} onChange={setTiming} />
      <p className="text-2xs text-muted-foreground">{t(`timingHints.${timing}`)}</p>
      {outcome ? (
        <p role={outcome.error ? "alert" : "status"} className={cn("text-2xs", outcome.error ? "text-destructive" : "text-muted-foreground")}>
          {outcome.message}
        </p>
      ) : null}
      {status === "failed" ? (
        <div className="space-y-1">
          <p role="alert" className="text-2xs text-destructive">
            {t("loadFailed")}
          </p>
          <Button variant="outline" size="sm" title={t("retry")} onClick={() => void presetLibrary.load(true)} />
        </div>
      ) : null}
      {status === "loading" && presets.length === 0 ? <p className="text-2xs text-muted-foreground">{t("loading")}</p> : null}
      <ul aria-label={t("gallery")} className="space-y-1">
        {presets.map((preset) => (
          <PresetTile key={preset.id} preset={preset} clips={clips} timing={timing} disabled={disabled} onOutcome={report} />
        ))}
      </ul>
    </InspectorSection>
  );
}
