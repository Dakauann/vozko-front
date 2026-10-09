"use client";

import type { AgentFocus, AgentStep } from "@/lib/studio/agent/batch";
import type { StudioEditorStore } from "@/lib/studio/store";

import type { AgentPresence } from "./presence";
import type { PresenceTarget } from "./targets";

export const MIN_STEP_MS = 120;
export const MAX_STEP_MS = 420;
export const BATCH_ANIMATION_MS = 2400;

export function stepDelay(count: number, reduceMotion: boolean): number {
  if (reduceMotion || count <= 0) return 0;
  return Math.round(Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, BATCH_ANIMATION_MS / count)));
}

export interface ReplayDeps<D extends object> {
  store: StudioEditorStore<D>;
  presence: AgentPresence;
  locate: (focus: AgentFocus, document: D) => PresenceTarget | null;
  label: (step: AgentStep<D>) => string;
  onStep?: (step: AgentStep<D>) => void;
  delayMs: number;
  quiet?: boolean;
  hidden?: () => boolean;
}

export type ReplayOutcome = "applied" | "interrupted";

const RENDER_MS = 16;

function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, RENDER_MS));
}

function wait(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

export async function replaySteps<D extends object>(base: D, steps: readonly AgentStep<D>[], deps: ReplayDeps<D>): Promise<ReplayOutcome> {
  const state = () => deps.store.getState();
  if (state().document !== base) return "interrupted";
  deps.presence.busy(true);
  state().beginTransaction();
  let expected = base;
  const finishAtOnce = (): ReplayOutcome => {
    deps.presence.progress({ step: steps.length, total: steps.length });
    const last = steps.at(-1);
    if (last && last.document !== state().document) state().apply(() => last.document);
    state().commitTransaction();
    return "applied";
  };
  try {
    if (deps.quiet || deps.hidden?.()) return finishAtOnce();
    for (const [index, step] of steps.entries()) {
      deps.presence.progress({ step: index + 1, total: steps.length });
      if (state().document !== expected) {
        state().cancelTransaction();
        return "interrupted";
      }
      if (deps.hidden?.()) return finishAtOnce();
      if (step.document !== expected) state().apply(() => step.document);
      expected = state().document;
      deps.onStep?.(step);
      await nextFrame();
      const target = deps.locate(step.focus, expected);
      deps.presence.point(target?.point ?? null, deps.label(step), target?.outline ?? null);
      await wait(deps.delayMs);
    }
    state().commitTransaction();
    return "applied";
  } finally {
    if (state().inTransaction) state().commitTransaction();
    deps.presence.busy(false);
    deps.presence.progress(null);
    deps.presence.rest();
  }
}
