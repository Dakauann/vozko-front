import type { TrackSample } from "../point-track";
import type { LumaImage } from "./luma";
import { PatternTracker, type TrackPoint, type TrackStep } from "./pattern-tracker";

export const TRACK_RUN = {
  chunkBytes: 64 * 1024 * 1024,
  assumedFps: 60,
  minChunkSec: 0.25,
  maxChunkSec: 4,
  epsilonSec: 1e-6,
  positionDigits: 1e5,
  confidenceDigits: 1e3,
} as const;

export type TrackDirection = "both" | "forward" | "backward";

export const TRACK_DIRECTIONS: readonly TrackDirection[] = ["both", "forward", "backward"];

export interface FeedFrame {
  timestamp: number;
  duration: number;
  luma: LumaImage;
}

export interface FrameFeed {
  readonly width: number;
  readonly height: number;
  frames(fromSec: number, toSec: number): AsyncIterable<FeedFrame>;
}

export interface TrackJob {
  point: TrackPoint;
  size: number;
  atMs: number;
  fromMs: number;
  toMs: number;
  direction: TrackDirection;
}

export interface TrackLoss {
  direction: "forward" | "backward";
  atMs: number;
  confidence: number;
}

export type TrackRun =
  | { kind: "tracked"; referenceMs: number; samples: TrackSample[]; loss: TrackLoss | null }
  | { kind: "flat" }
  | { kind: "outside" }
  | { kind: "empty" }
  | { kind: "cancelled" };

export interface TrackRunOptions {
  onProgress?: (done: number) => void;
  signal?: AbortSignal;
  chunkBytes?: number;
}

class Cancelled extends Error {}

function roundTo(value: number, digits: number): number {
  return Math.round(value * digits) / digits;
}

function msOf(seconds: number): number {
  return Math.round(seconds * 1000);
}

function sampleOf(frame: FeedFrame, point: TrackPoint, confidence: number, width: number, height: number): TrackSample {
  return {
    atMs: msOf(frame.timestamp),
    x: roundTo(Math.min(1, Math.max(0, point.x / width)), TRACK_RUN.positionDigits),
    y: roundTo(Math.min(1, Math.max(0, point.y / height)), TRACK_RUN.positionDigits),
    confidence: roundTo(confidence, TRACK_RUN.confidenceDigits),
  };
}

function chunkSeconds(feed: FrameFeed, budget: number): number {
  const perSecond = Math.max(1, feed.width * feed.height) * TRACK_RUN.assumedFps;
  return Math.min(TRACK_RUN.maxChunkSec, Math.max(TRACK_RUN.minChunkSec, budget / perSecond));
}

export async function runTrack(feed: FrameFeed, job: TrackJob, options: TrackRunOptions): Promise<TrackRun> {
  const fromSec = Math.min(job.fromMs, job.atMs) / 1000;
  const toSec = Math.max(job.toMs, job.atMs) / 1000;
  const referenceSec = job.atMs / 1000;
  const span = Math.max(TRACK_RUN.epsilonSec, toSec - fromSec);
  let forwardDone = job.direction === "backward" ? toSec - referenceSec : 0;
  let backwardDone = job.direction === "forward" ? referenceSec - fromSec : 0;
  const report = () => options.onProgress?.(Math.min(1, (forwardDone + backwardDone) / span));
  const checkpoint = () => {
    if (options.signal?.aborted) throw new Cancelled();
  };
  const samples: TrackSample[] = [];
  const earlier: TrackSample[] = [];
  let loss: TrackLoss | null = null;
  try {
    checkpoint();
    const iterator = feed.frames(referenceSec, toSec)[Symbol.asyncIterator]();
    let reference: FeedFrame | null = null;
    let tracker: PatternTracker | null = null;
    try {
      const first = await iterator.next();
      if (first.done) return { kind: "empty" };
      reference = first.value;
      const started = PatternTracker.start(reference.luma, { x: job.point.x * feed.width, y: job.point.y * feed.height, side: job.size * feed.height });
      if (typeof started === "string") return { kind: started };
      tracker = started;
      samples.push(sampleOf(reference, tracker.origin, 1, feed.width, feed.height));
      checkpoint();
      report();
      if (job.direction !== "backward") {
        for (let next = await iterator.next(); !next.done; next = await iterator.next()) {
          checkpoint();
          const frame = next.value;
          if (frame.timestamp > toSec + TRACK_RUN.epsilonSec) break;
          const step: TrackStep = tracker.step(frame.luma);
          if (step.lost) {
            loss = { direction: "forward", atMs: msOf(frame.timestamp), confidence: roundTo(step.confidence, TRACK_RUN.confidenceDigits) };
            break;
          }
          samples.push(sampleOf(frame, step, step.confidence, feed.width, feed.height));
          forwardDone = Math.min(toSec, frame.timestamp) - referenceSec;
          report();
        }
      }
    } finally {
      await iterator.return?.();
    }
    forwardDone = toSec - referenceSec;
    report();
    if (job.direction !== "forward" && reference && tracker) {
      tracker.rewind();
      const chunk = chunkSeconds(feed, options.chunkBytes ?? TRACK_RUN.chunkBytes);
      let end = reference.timestamp;
      let lost = false;
      while (!lost && end > fromSec + TRACK_RUN.epsilonSec) {
        const start = Math.max(fromSec, end - chunk);
        const held: FeedFrame[] = [];
        for await (const frame of feed.frames(start, end)) {
          checkpoint();
          if (frame.timestamp >= end - TRACK_RUN.epsilonSec) break;
          held.push(frame);
        }
        if (held.length === 0) break;
        for (const frame of held.reverse()) {
          checkpoint();
          const step = tracker.step(frame.luma);
          if (step.lost) {
            loss = { direction: "backward", atMs: msOf(frame.timestamp), confidence: roundTo(step.confidence, TRACK_RUN.confidenceDigits) };
            lost = true;
            break;
          }
          earlier.push(sampleOf(frame, step, step.confidence, feed.width, feed.height));
          backwardDone = referenceSec - Math.max(fromSec, frame.timestamp);
          report();
        }
        end = held[held.length - 1].timestamp;
      }
    }
  } catch (error) {
    if (error instanceof Cancelled) return { kind: "cancelled" };
    throw error;
  }
  backwardDone = referenceSec - fromSec;
  report();
  const ordered = [...earlier.reverse(), ...samples].filter((sample, i, all) => i === 0 || sample.atMs > all[i - 1].atMs);
  return { kind: "tracked", referenceMs: samples[0].atMs, samples: ordered, loss };
}
