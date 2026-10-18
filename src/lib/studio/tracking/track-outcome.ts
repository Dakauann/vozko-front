import type { PointTracker } from "../point-track";
import type { TrackLoss, TrackRun } from "./track-run";

export type TrackFailure = "flat" | "outside" | "empty" | "cancelled" | "undecodable" | "unsupported" | "failed" | "slow" | "lost";

export type TrackOutcome =
  | ({ frameWidth: number; frameHeight: number; size: number } & Extract<TrackRun, { kind: "tracked" }>)
  | { kind: Exclude<TrackFailure, "lost"> };

interface TrackerNaming {
  id: string;
  name?: string;
  keepPartial: boolean;
}

type TrackerResult = { ok: true; tracker: PointTracker; loss: TrackLoss | null } | { ok: false; reason: TrackFailure; loss?: TrackLoss };

export function trackerFromOutcome(outcome: TrackOutcome, naming: TrackerNaming): TrackerResult {
  if (outcome.kind !== "tracked") return { ok: false, reason: outcome.kind };
  if (outcome.loss && !naming.keepPartial) return { ok: false, reason: "lost", loss: outcome.loss };
  const tracker: PointTracker = {
    id: naming.id,
    ...(naming.name ? { name: naming.name } : {}),
    frameWidth: outcome.frameWidth,
    frameHeight: outcome.frameHeight,
    size: outcome.size,
    referenceMs: outcome.referenceMs,
    samples: outcome.samples,
  };
  return { ok: true, tracker, loss: outcome.loss };
}
