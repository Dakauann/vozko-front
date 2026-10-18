import { AI_PROGRESS_PILL_HEIGHT } from "@/lib/ai-progress";
import type { ImageAspect } from "@/lib/media-generation/types";

import { boxCorners } from "./arrange";
import { VIDEO_ASPECT_SIZES, type CanvasSize, type Transform } from "./document";
import { fittedTransform } from "./geometry";
import type { ScreenRect } from "./viewport";

export type OverlayPhase = "running" | "settling" | "failed";

export const OVERLAY_FAILURE_MS = 4000;

export interface OverlayEntry {
  jobId: string;
  targetId: string | null;
  purpose: string;
  phase: OverlayPhase;
  error: string | null;
  aspect?: ImageAspect;
  references: string[];
}

interface ImageJobLike {
  id: string;
  purpose: string;
  layerId: string | null;
  settling: boolean;
  error: string | null;
  created?: { aspect?: ImageAspect; referenceMediaIds: string[] } | null;
}

interface VideoJobLike {
  id: string;
  purpose: string;
  target: { clipId?: string };
  state: string;
  settling: boolean;
  error: { code: string } | null;
}

function phaseOf(failed: boolean, settling: boolean): OverlayPhase {
  if (failed) return "failed";
  return settling ? "settling" : "running";
}

export function imageJobOverlays(jobs: readonly ImageJobLike[]): OverlayEntry[] {
  return jobs.flatMap((job): OverlayEntry[] => {
    const base = { jobId: job.id, purpose: job.purpose, phase: phaseOf(job.error !== null, job.settling), error: job.error };
    if (job.layerId) return [{ ...base, targetId: job.layerId, references: [] }];
    const aspect = job.created?.aspect;
    return aspect ? [{ ...base, targetId: null, aspect, references: job.created?.referenceMediaIds ?? [] }] : [];
  });
}

export function videoJobOverlays(jobs: readonly VideoJobLike[]): OverlayEntry[] {
  return jobs.flatMap((job): OverlayEntry[] => {
    const clipId = job.target.clipId;
    if (!clipId || job.state === "done") return [];
    const failed = job.state === "failed";
    return [{ jobId: job.id, targetId: clipId, purpose: job.purpose, phase: phaseOf(failed, job.settling), error: failed ? (job.error?.code ?? null) : null, references: [] }];
  });
}

export function placeholderTransform(aspect: ImageAspect, canvas: CanvasSize): Transform {
  const size = VIDEO_ASPECT_SIZES[aspect];
  return fittedTransform(size.width, size.height, canvas);
}

export function readClipJobState(state: string): { jobId: string; phase: OverlayPhase } {
  const cut = state.lastIndexOf(":");
  return { jobId: state.slice(0, cut), phase: state.slice(cut + 1) as OverlayPhase };
}

export function clipJobState(jobs: readonly VideoJobLike[], clipId: string): string | null {
  const entries = videoJobOverlays(jobs).filter((entry) => entry.targetId === clipId);
  const last = entries.at(-1);
  return last ? `${last.jobId}:${last.phase}` : null;
}

export function overlayLabelKey(phase: OverlayPhase, purpose: string, running: string): string {
  if (phase === "failed") return `failed.${purpose}`;
  return phase === "settling" ? "finalizing" : `${running}.${purpose}`;
}

export function pendingMediaJobs(entries: readonly OverlayEntry[], mediaOf: (targetId: string) => string | null | undefined): Map<string, OverlayEntry> {
  return new Map(
    entries.flatMap((entry): [string, OverlayEntry][] => {
      const mediaId = entry.phase !== "failed" && entry.targetId ? mediaOf(entry.targetId) : null;
      return mediaId ? [[mediaId, entry]] : [];
    }),
  );
}

export const PILL = { height: AI_PROGRESS_PILL_HEIGHT, margin: 8, gap: 6, smallestSide: 40, charPx: 6.2, chromePx: 32, uprightDegrees: 15 } as const;

export type PillMode = "inside" | "outside" | "spinner";

interface PillLayout {
  mode: PillMode;
  width: number;
  inside: { left: number; top: number };
  outside: { left: number; top: number; side: "below" | "above" };
}

export function pillWidth(text: string): number {
  return Math.ceil([...text].length * PILL.charPx + PILL.chromePx);
}

function upright(rotation: number): boolean {
  const turned = ((((rotation + 180) % 360) + 360) % 360) - 180;
  return Math.abs(turned) <= PILL.uprightDegrees;
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(value, Math.max(low, high)));
}

export function placePill(transform: Transform, frame: ScreenRect, text: string, bounds: CanvasSize): PillLayout {
  const width = pillWidth(text);
  const boxWidth = transform.w * frame.width;
  const boxHeight = transform.h * frame.height;
  const corners = boxCorners(transform, frame).map(([x, y]) => [frame.left + x, frame.top + y]);
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  const below = Math.max(...ys) + PILL.gap;
  const side = below + PILL.height <= bounds.height - PILL.margin ? "below" : "above";
  const top = side === "below" ? below : Math.min(...ys) - PILL.gap - PILL.height;
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const outside = {
    side,
    left: clamp(centerX - width / 2, PILL.margin, bounds.width - width - PILL.margin),
    top: clamp(top, PILL.margin, bounds.height - PILL.height - PILL.margin),
  } as const;
  const inside = { left: (boxWidth - width) / 2, top: boxHeight - PILL.margin - PILL.height };
  const fits = upright(transform.rotation) && width + PILL.margin * 2 <= boxWidth && PILL.height + PILL.margin * 2 <= boxHeight;
  const mode: PillMode = Math.min(boxWidth, boxHeight) < PILL.smallestSide ? "spinner" : fits ? "inside" : "outside";
  return { mode, width, inside, outside };
}
