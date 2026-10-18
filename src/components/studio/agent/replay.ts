"use client";

import type { AgentFocus, AgentStep } from "@/lib/studio/agent/batch";
import { merge3 } from "@/lib/studio/merge3";
import type { StudioEditorStore } from "@/lib/studio/store";

import type { AgentPresence } from "./presence";
import type { PresenceTarget } from "./targets";

const MIN_STEP_MS = 120;
const MAX_STEP_MS = 420;
const BATCH_ANIMATION_MS = 2400;

const RENDER_MS = 16;
const GESTURE_POLL_MS = 50;

export function stepDelay(count: number, reduceMotion: boolean): number {
  if (reduceMotion || count <= 0) return 0;
  return Math.round(Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, BATCH_ANIMATION_MS / count)));
}

export interface ReplayDeps<D extends object> {
  store: StudioEditorStore<D>;
  presence: AgentPresence;
  locate: (focus: AgentFocus, document: D) => PresenceTarget | null;
  label: (step: AgentStep<D>) => string;
  onStep?: (step: AgentStep<D>, together: boolean) => void;
  valid: (document: D) => boolean;
  delayMs: number;
  quiet?: boolean;
  hidden?: () => boolean;
}

export interface ReplayOutcome {
  conflicts: string[];
  skipped: number[];
}

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(to - from, 0) }, (_, i) => from + i);
}

let batches = 0;

function wait(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

export async function replaySteps<D extends object>(base: D, steps: readonly AgentStep<D>[], deps: ReplayDeps<D>): Promise<ReplayOutcome> {
  const state = () => deps.store.getState();
  const group = `agent-${(batches += 1)}`;
  const conflicts = new Set<string>();
  const skipped: number[] = [];
  let previous = base;

  const land = async (step: AgentStep<D>, covered: readonly number[]): Promise<boolean> => {
    while (state().inTransaction) await wait(GESTURE_POLL_MS);
    const live = state().document;
    const merged = merge3(previous, live, step.document);
    previous = step.document;
    if (merged.value !== live && !deps.valid(merged.value)) {
      skipped.push(...covered);
      return false;
    }
    for (const path of merged.conflicts) conflicts.add(path);
    state().applyAs(group, () => merged.value);
    return state().document === step.document;
  };

  deps.presence.busy(true);
  try {
    if (deps.quiet || deps.hidden?.()) {
      const last = steps.at(-1);
      if (last) await land(last, range(0, steps.length));
      return { conflicts: [...conflicts], skipped };
    }
    for (const [index, step] of steps.entries()) {
      deps.presence.progress({ step: index + 1, total: steps.length });
      if (deps.hidden?.()) {
        await land(steps.at(-1)!, range(index, steps.length));
        break;
      }
      const together = await land(step, [index]);
      deps.onStep?.(step, together);
      await wait(RENDER_MS);
      const target = deps.locate(step.focus, state().document);
      deps.presence.point(target?.point ?? null, deps.label(step), target?.outline ?? null);
      await wait(deps.delayMs);
    }
    return { conflicts: [...conflicts], skipped };
  } finally {
    deps.presence.busy(false);
    deps.presence.progress(null);
    deps.presence.rest();
  }
}
