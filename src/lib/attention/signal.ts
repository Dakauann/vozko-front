import type { AttentionSignal, AttentionSource } from "./rules";

type Sink = (signal: AttentionSignal) => void;

const REMEMBERED_SIGNALS = 500;

let sink: Sink | null = null;

const seen = new Set<string>();

const viewing: Partial<Record<AttentionSource, string | null>> = {};

function firstTime(id: string): boolean {
  if (seen.has(id)) return false;
  seen.add(id);
  if (seen.size > REMEMBERED_SIGNALS) seen.delete(seen.values().next().value as string);
  return true;
}

export function setAttentionSink(next: Sink): () => void {
  sink = next;
  return () => {
    if (sink === next) sink = null;
  };
}

export function signalAttention(signal: AttentionSignal): void {
  if (sink && firstTime(signal.id)) sink(signal);
}

export function setViewing(source: AttentionSource, group: string | null): void {
  viewing[source] = group;
}

export function viewingNow(): Partial<Record<AttentionSource, string | null>> {
  return { ...viewing };
}
