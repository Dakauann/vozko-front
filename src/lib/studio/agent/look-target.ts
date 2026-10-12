import type { ScreenTarget } from "@/lib/aichat/screen";

import { STUDIO_LIMITS, type Artboard } from "../document";
import { formatRulerLabel } from "../timeline-view";

const SECOND_MS = 1000;
const TENTH_MS = 100;

export function momentsTarget(times: readonly number[]): ScreenTarget {
  return { kind: "moments", fromMs: Math.round(Math.min(...times)), toMs: Math.round(Math.max(...times)) };
}

function targetName(name: string | undefined): string {
  return [...(name ?? "").replace(/\p{Cc}/gu, " ").trim()].slice(0, STUDIO_LIMITS.maxProjectNameRunes).join("");
}

export function artboardTarget(artboards: readonly Artboard[], artboard: Artboard): ScreenTarget {
  const name = targetName(artboard.name);
  return { kind: "artboard", artboardId: artboard.id, n: artboards.findIndex((candidate) => candidate.id === artboard.id) + 1, ...(name ? { name } : {}) };
}

export function lookClock(span: { fromMs: number; toMs: number }): string[] {
  const step = span.toMs - span.fromMs >= SECOND_MS || span.toMs === span.fromMs ? SECOND_MS : TENTH_MS;
  const from = formatRulerLabel(span.fromMs, step);
  const to = formatRulerLabel(span.toMs, step);
  return from === to ? [from] : [from, to];
}
