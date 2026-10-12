"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { activeArtboard, artboardOfItem } from "@/lib/studio/artboards";
import type { CanvasSize } from "@/lib/studio/document";
import { imageJobOverlays, overlayLabelKey, placeholderTransform, type OverlayEntry } from "@/lib/studio/job-overlay";
import { frameRect, localViewport } from "@/lib/studio/viewport";

import { JobOverlays, type JobOverlayView } from "../ai/job-overlay";
import { useEditorUi, useImageDoc } from "./editor-state";

const UNBOUNDED: CanvasSize = { width: Number.MAX_SAFE_INTEGER, height: Number.MAX_SAFE_INTEGER };

function OverlayLayer({ entries }: { entries: readonly OverlayEntry[] }) {
  const t = useTranslations("studio.image.jobs");
  const ta = useTranslations("studio.aiActions");
  const document = useImageDoc((s) => s.document);
  const selection = useImageDoc((s) => s.selection);
  const viewport = useEditorUi((s) => s.viewport);
  const live = useEditorUi((s) => s.live);
  const container = useEditorUi((s) => s.container);
  const artboardId = useEditorUi((s) => s.artboardId);
  const hovered = useEditorUi((s) => s.hoverLayerId);
  const bounds = container ?? UNBOUNDED;
  const active = activeArtboard(document, artboardId);
  const activeFrame = frameRect(localViewport(viewport, active), active.canvas);

  const views = entries.flatMap((entry): JobOverlayView[] => {
    const failed = entry.phase === "failed";
    const status = {
      phase: entry.phase,
      label: t(overlayLabelKey(entry.phase, entry.purpose, "running")),
      ...(failed && entry.error ? { detail: t(`errors.${entry.error}`) } : {}),
      bounds,
    };
    if (entry.targetId === null) {
      if (!entry.aspect) return [];
      const references = failed
        ? []
        : active.layers
            .filter((layer) => !layer.hidden && layer.assetId && entry.references.includes(layer.assetId))
            .map((layer): JobOverlayView => ({ ...status, key: `${entry.jobId}:${layer.id}`, targetId: layer.id, variant: "reference", label: ta("reference"), transform: live?.[layer.id] ?? layer.transform, frame: activeFrame }));
      return [...references, { ...status, key: entry.jobId, targetId: `placeholder:${entry.jobId}`, variant: "job", transform: placeholderTransform(entry.aspect, active.canvas), frame: activeFrame, revealed: true }];
    }
    const artboard = artboardOfItem(document, entry.targetId);
    const layer = artboard?.layers.find((candidate) => candidate.id === entry.targetId);
    if (!artboard || !layer || layer.hidden) return [];
    return [
      {
        ...status,
        key: entry.jobId,
        targetId: layer.id,
        variant: "job",
        transform: live?.[layer.id] ?? layer.transform,
        frame: frameRect(localViewport(viewport, artboard), artboard.canvas),
        revealed: hovered === layer.id || selection.includes(layer.id),
      },
    ];
  });
  return (
    <div data-studio-ui-only className="pointer-events-none absolute inset-0 overflow-hidden">
      <JobOverlays views={views} />
    </div>
  );
}

export function ImageJobOverlays() {
  const jobs = useEditorUi((s) => s.jobs);
  const entries = useMemo(() => imageJobOverlays(jobs), [jobs]);
  return entries.length > 0 ? <OverlayLayer entries={entries} /> : null;
}
