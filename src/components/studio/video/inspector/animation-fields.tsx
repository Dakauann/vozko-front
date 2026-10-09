"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import { CaretDown, CaretLeft, CaretRight, ClipboardText, Copy, Question, X } from "@/components/icons";
import type { Clip } from "@/lib/studio/document";
import { adjacentKey, localTime } from "@/lib/studio/keyframe-edit";
import { captureKeyframes, keyframeClipboardAction, pastePatch, presetPatch } from "@/lib/studio/keyframe-presets";
import { seekInside, selectionEasing, selectionKeyTimes, selectionMoment, setSelectionEasing, toggleSelectionMoment } from "@/lib/studio/selection-edit";
import { cn } from "@/lib/utils";

import { usePanelPlayhead, useVideoEditor } from "../editor-context";
import { ToolButton } from "../tool-button";
import { EasingPicker } from "./easing-picker";
import { InspectorSection } from "./fields";
import { dismissCoach, keyframeClipboard, noteMomentClick, openCoach, setKeyframeClipboard, useKeyframeUi } from "./keyframe-coach";
import { KeyDiamond, PropertyKeyList } from "./keyframe-fields";
import { PresetGrid } from "./preset-grid";
import { reportSelection } from "./selection-notice";
import type { SelectionEditor } from "./use-selection-editor";

interface AnimationFieldsProps {
  clips: readonly Clip[];
  disabled: boolean;
  editor: SelectionEditor;
}

function KeyMomentButton({ on, disabled, label, onClick }: { on: boolean; disabled: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      title={label}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[--radius] text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
        "h-8 min-w-0 flex-1 px-3",
        on
          ? "bg-primary text-primary-foreground shadow-button-primary hover:bg-[hsl(var(--primary-hover))]"
          : "border border-[hsl(var(--control-edge))] bg-card text-foreground shadow-sm hover:bg-muted",
      )}
    >
      <KeyDiamond filled={on} className="h-3.5 w-3.5" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function Coach() {
  const t = useTranslations("studio.video.keyframes");
  const tc = useTranslations("studio.video");
  return (
    <div role="note" className="notice notice-info space-y-1.5 px-2.5 py-2 text-2xs">
      <div className="flex items-center justify-between gap-2">
        <span className="notice-ink font-semibold">{t("coachTitle")}</span>
        <button type="button" aria-label={tc("dismiss")} onClick={dismissCoach} className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X className="h-3 w-3" aria-hidden />
        </button>
      </div>
      <ol className="list-decimal space-y-1 pl-4 text-foreground">
        <li>{t("coachStep1")}</li>
        <li>{t("coachStep2")}</li>
      </ol>
      <p className="text-foreground">{t("coachDone")}</p>
      <button type="button" onClick={dismissCoach} className="text-2xs font-medium text-primary-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {t("coachDismiss")}
      </button>
    </div>
  );
}

export function AnimationFields({ clips, disabled, editor }: AnimationFieldsProps) {
  const t = useTranslations("studio.video.keyframes");
  const { playback } = useVideoEditor();
  const playheadMs = usePanelPlayhead();
  const coachOpen = useKeyframeUi((s) => s.coachOpen);
  const hasClipboard = useKeyframeUi((s) => s.clipboard !== null);
  const moment = selectionMoment(clips, playheadMs);
  const outside = moment === "outside";
  const times = selectionKeyTimes(clips);
  const easing = selectionEasing(clips, playheadMs);
  const inside = seekInside(clips, playheadMs);
  const single = clips.length === 1 ? clips[0] : null;

  const toggleMoment = () => {
    noteMomentClick();
    editor.run((doc) => toggleSelectionMoment(doc, editor.ids, editor.playheadMs()));
  };

  const copy = () => {
    const source = clips.map(captureKeyframes).find((captured) => captured !== null);
    if (!source) {
      reportSelection("noKeys");
      return;
    }
    setKeyframeClipboard(source);
    reportSelection("copied");
  };

  const paste = () => {
    const snippet = keyframeClipboard();
    if (!snippet) {
      reportSelection("clipboardEmpty");
      return;
    }
    editor.patch((clip) => pastePatch(clip, snippet, localTime(clip, editor.playheadMs())));
  };

  const shortcuts = useRef({ copy, paste, disabled });
  useEffect(() => {
    shortcuts.current = { copy, paste, disabled };
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = keyframeClipboardAction(event);
      if (!action || (action === "paste" && shortcuts.current.disabled)) return;
      event.preventDefault();
      shortcuts.current[action]();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const stateText = outside ? (inside === null ? t("state.apart") : clips.length > 1 ? t("state.outsideMany") : t("state.outside")) : t(`state.${moment}`);

  return (
    <InspectorSection
      title={t("title")}
      action={
        <button type="button" onClick={openCoach} className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Question className="h-3 w-3" aria-hidden />
          {t("howItWorks")}
        </button>
      }
    >
      <div className="flex items-center gap-1">
        <ToolButton
          size="md"
          label={t("previousMoment")}
          disabled={adjacentKey(times, playheadMs, -1) === null}
          icon={<CaretLeft className="h-3.5 w-3.5" />}
          onClick={() => {
            const at = adjacentKey(times, playheadMs, -1);
            if (at !== null) playback.seek(at);
          }}
        />
        <KeyMomentButton on={moment === "key"} disabled={disabled || outside} label={moment === "key" ? t("remove") : t("add")} onClick={toggleMoment} />
        <ToolButton
          size="md"
          label={t("nextMoment")}
          disabled={adjacentKey(times, playheadMs, 1) === null}
          icon={<CaretRight className="h-3.5 w-3.5" />}
          onClick={() => {
            const at = adjacentKey(times, playheadMs, 1);
            if (at !== null) playback.seek(at);
          }}
        />
      </div>
      <p role="status" className="text-2xs text-muted-foreground">
        {stateText}
      </p>
      {outside && inside !== null ? (
        <button
          type="button"
          onClick={() => playback.seek(inside)}
          className="inline-flex h-7 items-center rounded-[--radius] border border-[hsl(var(--control-edge))] bg-card px-2.5 text-xs font-medium text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("goToClip")}
        </button>
      ) : null}
      {coachOpen ? <Coach /> : null}

      <EasingPicker
        label={easing.scope === "moment" ? t("easingMoment") : t("easingAll")}
        value={easing.easing}
        disabled={disabled || times.length === 0 || (easing.scope === "moment" && outside)}
        onPick={(next) => editor.run((doc) => setSelectionEasing(doc, editor.ids, editor.playheadMs(), next))}
      />

      <PresetGrid disabled={disabled} onApply={(id) => editor.patch((clip) => presetPatch(clip, id))} />

      <div className="flex flex-wrap items-center gap-1">
        <ToolButton size="sm" showLabel label={t("copy")} shortcut="Ctrl+Alt+C" disabled={times.length === 0} icon={<Copy className="h-3.5 w-3.5" />} onClick={copy} />
        <ToolButton size="sm" showLabel label={t("paste")} shortcut="Ctrl+Alt+V" disabled={disabled || !hasClipboard || outside} icon={<ClipboardText className="h-3.5 w-3.5" />} onClick={paste} />
      </div>

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1 rounded-[--radius] py-0.5 text-2xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <CaretDown className="h-3 w-3 -rotate-90 transition-transform group-open:rotate-0" aria-hidden />
          {t("advanced")}
        </summary>
        <div className="space-y-1 pt-1.5">
          {single ? (
            <>
              <p className="text-2xs text-muted-foreground">{t("advancedHint")}</p>
              <PropertyKeyList clip={single} disabled={disabled} />
            </>
          ) : (
            <p className="text-2xs text-muted-foreground">{t("advancedSingle")}</p>
          )}
        </div>
      </details>
    </InspectorSection>
  );
}
