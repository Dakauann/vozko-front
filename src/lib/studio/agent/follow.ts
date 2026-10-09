import type { VideoDocument } from "../document";
import { findClip } from "../timeline";
import type { AgentFocus } from "./batch";

export const FOLLOW_LEAD_MS = 500;
export const GLIDE_MS = 360;

export function followTime(focus: AgentFocus, doc: VideoDocument, playheadMs: number): number | null {
  switch (focus.kind) {
    case "clip": {
      const found = findClip(doc, focus.clipId);
      if (!found) return null;
      const { startMs, durationMs } = found.clip;
      if (playheadMs >= startMs && playheadMs < startMs + durationMs) return null;
      return startMs + Math.min(FOLLOW_LEAD_MS, durationMs / 2);
    }
    case "track":
      return focus.atMs ?? null;
    case "time":
      return focus.atMs;
    default:
      return null;
  }
}

export function glidePosition(fromMs: number, toMs: number, progress: number): number {
  const t = Math.min(1, Math.max(0, progress));
  return fromMs + (toMs - fromMs) * (1 - (1 - t) ** 3);
}
