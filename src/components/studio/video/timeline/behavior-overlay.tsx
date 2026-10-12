"use client";

import { useTranslations } from "next-intl";

import { behaviorsOnLane, laneTracePoints } from "@/lib/studio/behavior-view";
import type { Clip } from "@/lib/studio/document";
import { KEY_LANE_HEIGHT } from "@/lib/studio/focus-lanes";
import type { AnimatedProperty } from "@/lib/studio/keyframes";

import { BehaviorGlyph } from "../behavior-glyph";
import { useEditorState } from "../editor-context";
import { useReactLevels } from "../react-levels";

export function BehaviorOverlay({ clip, lane, width }: { clip: Clip; lane: AnimatedProperty; width: number }) {
  const t = useTranslations("studio.video.behaviors");
  const tp = useTranslations("studio.video.keyframes.properties");
  const document = useEditorState((s) => s.document);
  const levels = useReactLevels(document);
  const shown = behaviorsOnLane(clip, lane);
  if (shown.length === 0) return null;
  const points = laneTracePoints(clip, lane, width, KEY_LANE_HEIGHT, levels);
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-primary/5" data-behavior-band={lane} />
      {points.length > 0 ? (
        <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible text-primary-ink" viewBox={`0 0 ${width} ${KEY_LANE_HEIGHT}`} preserveAspectRatio="none" data-behavior-trace={lane}>
          <polyline points={points.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.25} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
        </svg>
      ) : null}
      <span className="pointer-events-none absolute left-1 top-0.5 flex items-center gap-0.5 rounded-sm bg-card/90 px-0.5 text-primary-ink" role="img" aria-label={shown.map((behavior) => t("item", { kind: t(`kinds.${behavior.kind}`), property: tp(behavior.property) })).join(", ")}>
        {shown.map((behavior) => (
          <BehaviorGlyph key={behavior.id} kind={behavior.kind} className="h-2.5 w-3" />
        ))}
      </span>
    </>
  );
}
