"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Clip, VideoDocument } from "@/lib/studio/document";
import { coveringTransition, EDGE_TRANSITION_KINDS, edgeChoiceOf, edgeChoicePatch, edgeOptionsOf, edgeTransition, edgeTransitionOf, edgeTransitionPatch, isEdgeTransitionKind, type EdgeChoice, type EdgeTransitionKind } from "@/lib/studio/edge-transitions";
import type { Easing } from "@/lib/studio/keyframes";
import { DEFAULT_MOTION_MS, ENTRANCE_PRESETS, EXIT_PRESETS, type MotionSide } from "@/lib/studio/motion";
import { sharedValue, type PatchBuilder } from "@/lib/studio/selection-edit";
import { findClip } from "@/lib/studio/timeline";
import type { TransitionOptions } from "@/lib/studio/transitions";
import { cn } from "@/lib/utils";

import { useEditorState } from "../editor-context";
import { useEdgeThumbnails } from "../panels/transition-thumbnails";
import { TransitionPreview } from "../transition-glyph";
import { EasingPicker } from "./easing-picker";
import { FieldGrid, InspectorSection, NumberField } from "./fields";
import { TransitionOptionFields } from "./transition-option-fields";

const MS = 1000;

interface MotionFieldsProps {
  clips: readonly Clip[];
  disabled: boolean;
  onPatch: (build: PatchBuilder) => boolean;
}

const TILE_CLASS =
  "flex min-w-0 flex-col items-center gap-1 rounded-[--radius] border px-1.5 py-1.5 text-[10px] font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

function sideDuration(clip: Clip, side: MotionSide): number {
  const transition = edgeTransitionOf(clip, side);
  if (transition) return transition.durationMs;
  const motion = side === "in" ? clip.motionIn : clip.motionOut;
  const fade = side === "in" ? clip.fadeInMs : clip.fadeOutMs;
  return motion?.durationMs ?? (fade > 0 ? fade : DEFAULT_MOTION_MS);
}

function covered(doc: VideoDocument, clips: readonly Clip[], side: MotionSide): boolean {
  return clips.some((clip) => {
    const found = findClip(doc, clip.id);
    return found !== null && coveringTransition(found.track, clip.id, side) !== undefined;
  });
}

function edgeOptionPatch(side: MotionSide, change: TransitionOptions & { easing?: Easing }): PatchBuilder {
  return (clip) => {
    const current = edgeTransitionOf(clip, side);
    if (!current) return null;
    const next = edgeTransition({ ...change, kind: current.kind }, current);
    return typeof next === "string" ? "invalid" : edgeTransitionPatch(side, next);
  };
}

interface EdgePickerProps {
  side: MotionSide;
  choice: EdgeChoice | "custom" | null;
  disabled: boolean;
  covered: boolean;
  onPick: (choice: EdgeChoice) => void;
}

function EdgePicker({ side, choice, disabled, covered, onPick }: EdgePickerProps) {
  const t = useTranslations("studio.video.motion");
  const tk = useTranslations("studio.video.transitions");
  const [open, setOpen] = useState(false);
  const thumbnails = useEdgeThumbnails(open);
  const presets = side === "in" ? ENTRANCE_PRESETS : EXIT_PRESETS;
  const label = side === "in" ? t("entrance") : t("exit");
  const nameOf = (value: EdgeChoice | "custom") => (isEdgeTransitionKind(value) ? tk(`kinds.${value}`) : t(`presets.${value}`));
  const pick = (value: EdgeChoice) => {
    onPick(value);
    setOpen(false);
  };
  const tile = (value: EdgeChoice, body: ReactNode, title: string, off: boolean) => (
    <button
      key={value}
      type="button"
      aria-pressed={choice === value}
      title={title}
      disabled={off}
      onClick={() => pick(value)}
      className={cn(TILE_CLASS, choice === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted")}
    >
      {body}
      <span className="line-clamp-2 block min-h-[2lh] max-w-full break-words text-center">{nameOf(value)}</span>
    </button>
  );
  return (
    <div className="space-y-1">
      <span className="block text-2xs text-muted-foreground">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={label}
            disabled={disabled}
            className="flex h-8 w-full min-w-0 items-center gap-2 rounded-[--radius] border border-control-edge bg-card px-2 text-left text-xs text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="min-w-0 flex-1 truncate">{choice === null ? t("mixed") : nameOf(choice)}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="left" align="start" className="max-h-[70vh] w-80 space-y-3 overflow-y-auto p-3">
          <div role="group" aria-label={t("effectsGroup")} className="space-y-1.5">
            <span className="block text-2xs font-semibold text-muted-foreground">{t("effectsGroup")}</span>
            <div className="grid grid-cols-3 gap-1.5">{presets.map((value) => tile(value, null, t(`presets.${value}`), false))}</div>
          </div>
          <div role="group" aria-label={t("transitionsGroup")} className="space-y-1.5">
            <span className="block text-2xs font-semibold text-muted-foreground">{t("transitionsGroup")}</span>
            {covered ? <p className="text-2xs text-muted-foreground">{side === "in" ? t("coveredIn") : t("coveredOut")}</p> : null}
            <div className="grid grid-cols-3 gap-1.5">
              {EDGE_TRANSITION_KINDS.map((kind: EdgeTransitionKind) => tile(kind, <TransitionPreview kind={kind} mode="edge" src={thumbnails?.get(kind)} />, tk(`hints.${kind}`), covered))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function MotionFields({ clips, disabled, onPatch }: MotionFieldsProps) {
  const t = useTranslations("studio.video.motion");
  const tk = useTranslations("studio.video.transitions");
  const document = useEditorState((s) => s.document);
  const shortest = Math.min(...clips.map((clip) => clip.durationMs));

  const side = (which: MotionSide) => {
    const current = sharedValue(clips, (clip) => edgeChoiceOf(clip, which));
    const choice = current.kind === "same" ? current.value : null;
    const duration = sharedValue(clips, (clip) => sideDuration(clip, which));
    const timed: EdgeChoice | null = choice !== null && choice !== "none" && choice !== "custom" ? choice : null;
    const choose = (clip: Clip, next: EdgeChoice, ms: number) => {
      const patch = edgeChoicePatch(clip, which, next, ms);
      return typeof patch === "string" ? "invalid" : patch;
    };
    const setDuration = (ms: (clip: Clip) => number) => onPatch((clip) => (timed ? choose(clip, timed, Math.max(100, ms(clip))) : null));
    const transition = choice !== null && isEdgeTransitionKind(choice) ? edgeTransitionOf(clips[0], which) : undefined;
    const easing = sharedValue(clips, (clip) => edgeTransitionOf(clip, which)?.easing);
    return (
      <div className="space-y-2">
        <FieldGrid>
          <EdgePicker
            side={which}
            choice={choice}
            disabled={disabled}
            covered={covered(document, clips, which)}
            onPick={(next) => onPatch((clip) => choose(clip, next, sideDuration(clip, which)))}
          />
          <NumberField
            label={which === "in" ? t("durationIn") : t("durationOut")}
            unit="s"
            step={0.1}
            decimals={2}
            min={0.1}
            max={shortest / MS}
            value={duration.kind === "same" ? duration.value / MS : null}
            disabled={disabled || !timed}
            onCommit={(seconds) => setDuration(() => Math.round(seconds * MS))}
            onNudge={(delta) => setDuration((clip) => Math.round(sideDuration(clip, which) + delta * MS))}
          />
        </FieldGrid>
        {transition ? (
          <div className="space-y-2 rounded-[--radius] border border-border p-2">
            <EasingPicker label={tk("easing")} value={easing.kind === "same" && easing.value ? easing.value : transition.easing} disabled={disabled} hidden={["hold"]} onPick={(next) => onPatch(edgeOptionPatch(which, { easing: next }))} />
            <TransitionOptionFields shaped={transition} allowed={edgeOptionsOf(transition.kind)} edge disabled={disabled} patch={(change) => onPatch(edgeOptionPatch(which, change))} />
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <InspectorSection title={t("title")}>
      {side("in")}
      {side("out")}
      <p className="text-2xs text-muted-foreground">{t("hint")}</p>
      <p className="text-2xs text-muted-foreground">{t("transitionHint")}</p>
    </InspectorSection>
  );
}
