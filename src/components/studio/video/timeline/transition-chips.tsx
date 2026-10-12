"use client";

import { useTranslations } from "next-intl";

import { Plus } from "@/components/icons";
import type { Track } from "@/lib/studio/document";
import { msToPx } from "@/lib/studio/timeline-view";
import { addTransition, cutsOf, defaultTransitionKind, transitionWindow } from "@/lib/studio/transitions";
import { cn } from "@/lib/utils";

import { useVideoEditor, useViewState } from "../editor-context";
import { TransitionGlyph } from "../transition-glyph";
import { useTimelineGeometry } from "./timeline-geometry";

const MIN_CHIP_PX = 10;

export function TransitionChips({ track }: { track: Track }) {
  const t = useTranslations("studio.video.transitions");
  const { commands } = useVideoEditor();
  const { pxPerSecond } = useTimelineGeometry();
  const selected = useViewState((s) => s.selectedTransitionId);
  const transitions = track.transitions ?? [];
  const covered = new Set(transitions.map((transition) => `${transition.fromClipId}>${transition.toClipId}`));
  const locked = Boolean(track.locked);

  return (
    <>
      {transitions.map((transition) => {
        const window = transitionWindow(transition, track);
        if (!window) return null;
        const label = t("chip", { kind: t(`kinds.${transition.kind}`) });
        return (
          <button
            key={transition.id}
            type="button"
            data-transition-id={transition.id}
            aria-label={label}
            title={label}
            aria-pressed={selected === transition.id}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => commands.selectTransition(transition.id)}
            className={cn(
              "absolute inset-y-2 z-[7] flex items-center justify-center overflow-hidden rounded-[4px] border text-primary-ink shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected === transition.id ? "border-primary bg-primary text-primary-foreground" : "border-primary/60 bg-card/90 hover:bg-card",
            )}
            style={{ left: msToPx(window.startMs, pxPerSecond), width: Math.max(MIN_CHIP_PX, msToPx(window.endMs - window.startMs, pxPerSecond)) }}
          >
            <TransitionGlyph kind={transition.kind} className="h-3.5 w-4 shrink-0" />
          </button>
        );
      })}
      {locked
        ? null
        : cutsOf(track)
            .filter((cut) => !covered.has(`${cut.fromClipId}>${cut.toClipId}`))
            .map((cut) => (
              <button
                key={`${cut.fromClipId}>${cut.toClipId}`}
                type="button"
                aria-label={t("addAt")}
                title={t("addAt")}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => commands.editTransition((doc) => addTransition(doc, { fromClipId: cut.fromClipId, toClipId: cut.toClipId, kind: defaultTransitionKind(track.kind) }))}
                className="absolute top-1/2 z-[7] flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border-strong bg-card text-muted-foreground opacity-60 shadow-sm transition-opacity hover:text-foreground hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ left: msToPx(cut.atMs, pxPerSecond) }}
              >
                <Plus className="h-2.5 w-2.5" aria-hidden />
              </button>
            ))}
    </>
  );
}
