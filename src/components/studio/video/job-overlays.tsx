"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { videoCanvasSize } from "@/lib/studio/document";
import { overlayLabelKey, videoJobOverlays, type OverlayEntry } from "@/lib/studio/job-overlay";
import { visualPlan } from "@/lib/studio/playback";

import { JobOverlays, type JobOverlayView } from "../ai/job-overlay";
import { useEditorState, useViewState } from "./editor-context";
import { KNOWN_JOB_ERRORS } from "./panels/job-status";
import { previewPlacement } from "./preview/preview-placement";

function OverlayLayer({ entries }: { entries: readonly OverlayEntry[] }) {
  const t = useTranslations("mediaGeneration");
  const tj = useTranslations("studio.video.jobs");
  const document = useEditorState((s) => s.document);
  const selection = useEditorState((s) => s.selection);
  const playheadMs = useViewState((s) => s.playheadMs);
  const previewFit = useViewState((s) => s.previewFit);
  const previewViewport = useViewState((s) => s.previewViewport);
  const previewContainer = useViewState((s) => s.previewContainer);
  const placement = previewPlacement({ previewFit, previewViewport, previewContainer }, videoCanvasSize(document));
  if (!placement) return null;
  const frame = { left: 0, top: 0, width: placement.frame.width, height: placement.frame.height };
  const wanted = new Set(entries.map((entry) => entry.targetId));
  const shown = new Map(visualPlan(document, playheadMs, 0).flatMap((item) => (item.active && item.type !== "effect" && wanted.has(item.clipId) ? [[item.clipId, item.transform] as const] : [])));
  const views = entries.flatMap((entry): JobOverlayView[] => {
    const transform = entry.targetId ? shown.get(entry.targetId) : undefined;
    if (!entry.targetId || !transform) return [];
    const failed = entry.phase === "failed";
    return [
      {
        key: entry.jobId,
        targetId: entry.targetId,
        variant: "job",
        phase: entry.phase,
        label: t(overlayLabelKey(entry.phase, entry.purpose, "generating")),
        ...(failed && entry.error && KNOWN_JOB_ERRORS.has(entry.error) ? { detail: tj(`errors.${entry.error}`) } : {}),
        transform,
        frame,
        bounds: { width: frame.width, height: frame.height },
        revealed: selection.includes(entry.targetId),
      },
    ];
  });
  return <JobOverlays views={views} />;
}

export function VideoJobOverlays() {
  const jobs = useViewState((s) => s.jobs);
  const entries = useMemo(() => videoJobOverlays(jobs), [jobs]);
  return entries.length > 0 ? <OverlayLayer entries={entries} /> : null;
}
