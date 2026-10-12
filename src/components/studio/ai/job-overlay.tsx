"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { AiProgressPill, AiProgressSurface, type AiProgressIndicator } from "@/components/elevated-design/ai-progress-surface";
import type { CanvasSize, Transform } from "@/lib/studio/document";
import { OVERLAY_FAILURE_MS, placePill, type OverlayPhase, type PillMode } from "@/lib/studio/job-overlay";
import { boxStyle } from "@/lib/studio/playback";
import type { ScreenRect } from "@/lib/studio/viewport";

export interface JobOverlayView {
  key: string;
  targetId: string;
  variant: "job" | "reference";
  phase: OverlayPhase;
  label: string;
  detail?: string;
  transform: Transform;
  frame: ScreenRect;
  bounds: CanvasSize;
  revealed?: boolean;
}

const OVERLAY_DEPTH = 860;
const INDICATOR: Record<PillMode, AiProgressIndicator> = { inside: "bottom", outside: "none", spinner: "badge" };

export function useFailureShown(key: string, phase: OverlayPhase): boolean {
  const [expired, setExpired] = useState<string | null>(null);
  useEffect(() => {
    if (phase !== "failed") return;
    const timer = setTimeout(() => setExpired(key), OVERLAY_FAILURE_MS);
    return () => clearTimeout(timer);
  }, [key, phase]);
  return !(phase === "failed" && expired === key);
}

function ReferenceMarker({ view }: { view: JobOverlayView }) {
  const { left, top, width, height } = view.frame;
  return (
    <div className="pointer-events-none absolute" style={{ left, top, width, height }}>
      <div data-job-reference={view.targetId} className="pointer-events-none absolute" style={boxStyle({ transform: view.transform, opacity: 1, trackIndex: OVERLAY_DEPTH - 1 })}>
        <span aria-hidden className="absolute inset-0 border border-dashed border-primary/70 bg-primary/5" />
        <span aria-hidden className="absolute left-1 top-1 whitespace-nowrap rounded-full bg-popover/90 px-1.5 text-2xs text-popover-foreground">
          {view.label}
        </span>
      </div>
    </div>
  );
}

function JobOverlayItem({ view }: { view: JobOverlayView }) {
  const shown = useFailureShown(view.key, view.phase);
  const still = Boolean(useReducedMotion());
  if (!shown) return null;
  const failed = view.phase === "failed";
  const layout = placePill(view.transform, view.frame, view.label, view.bounds);
  const outside = layout.mode === "outside" || (layout.mode === "spinner" && view.revealed);
  const { left, top, width, height } = view.frame;
  return (
    <>
      <div className="pointer-events-none absolute" style={{ left, top, width, height }}>
        <div
          data-job-overlay={view.targetId}
          data-phase={view.phase}
          data-motion={still ? "static" : "animated"}
          className="pointer-events-none absolute"
          style={boxStyle({ transform: view.transform, opacity: 1, trackIndex: OVERLAY_DEPTH })}
        >
          <AiProgressSurface label={view.label} detail={view.detail} failed={failed} indicator={INDICATOR[layout.mode]} className="absolute inset-0" />
        </div>
      </div>
      {outside ? <AiProgressPill label={view.label} detail={view.detail} failed={failed} placement={layout.outside.side} className="absolute" style={{ left: layout.outside.left, top: layout.outside.top, zIndex: OVERLAY_DEPTH + 2 }} /> : null}
    </>
  );
}

export function JobOverlays({ views }: { views: readonly JobOverlayView[] }) {
  return (
    <>
      {views.map((view) => (view.variant === "reference" ? <ReferenceMarker key={view.key} view={view} /> : <JobOverlayItem key={view.key} view={view} />))}
    </>
  );
}

export function JobBarState({ jobKey, phase }: { jobKey: string; phase: OverlayPhase }) {
  const shown = useFailureShown(jobKey, phase);
  const still = Boolean(useReducedMotion());
  if (!shown) return null;
  return (
    <span aria-hidden data-job-bar={phase} data-motion={still ? "static" : "animated"} className="pointer-events-none absolute inset-0 z-[2]">
      <AiProgressSurface failed={phase === "failed"} indicator="none" flush className="absolute inset-0" />
    </span>
  );
}
