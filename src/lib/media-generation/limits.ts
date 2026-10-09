import { PROCESSING_KINDS, type MediaKind, type ProcessingKind } from "./types";

export const MAX_PARALLEL_GENERATIONS = 3;
export const MAX_PARALLEL_PROCESSING = 2;
export const KEPT_FINISHED_JOBS = 3;

export function isProcessingKind(kind: MediaKind): kind is ProcessingKind {
  return (PROCESSING_KINDS as readonly string[]).includes(kind);
}

export function ceilingFor(kind: MediaKind): number {
  return isProcessingKind(kind) || kind === "video" ? MAX_PARALLEL_PROCESSING : MAX_PARALLEL_GENERATIONS;
}

export function sameLane(a: MediaKind, b: MediaKind): boolean {
  return ceilingFor(a) === ceilingFor(b) && (isProcessingKind(a) || a === "video") === (isProcessingKind(b) || b === "video");
}

export function canStart(kind: MediaKind, running: readonly MediaKind[]): boolean {
  return running.filter((other) => sameLane(kind, other)).length < ceilingFor(kind);
}
