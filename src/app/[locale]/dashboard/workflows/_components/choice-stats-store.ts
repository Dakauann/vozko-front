import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";

import { getWorkflowChoiceStatsAction } from "@/app/actions/workflows";
import { presetRange, type PeriodPreset } from "@/lib/attendance/period";
import type { ChoiceStatsAnswer } from "@/lib/choice-stats/answer";
import { sameNodeChoiceStats, type PromptStats, type WorkflowChoiceStats } from "@/lib/choice-stats/stats";
import { isInteractivePromptType } from "@/lib/workflows/types";

import { createValueStore, type ValueStore } from "./value-store";

export type CanvasChoiceStatsResult = ChoiceStatsAnswer<WorkflowChoiceStats>;

export interface CanvasChoiceStats {
  loading: boolean;
  result: CanvasChoiceStatsResult | null;
}

export type ChoiceStatsStore = ValueStore<CanvasChoiceStats>;

export type NodeChoiceView = { kind: "stats"; stats: PromptStats } | { kind: "no_sends" };

export const CHOICE_STATS_PERIODS: readonly PeriodPreset[] = ["7d", "30d", "90d"];
export const DEFAULT_CHOICE_STATS_PERIOD: PeriodPreset = "30d";

const IDLE: CanvasChoiceStats = { loading: false, result: null };
const NO_SENDS: NodeChoiceView = { kind: "no_sends" };
const views = new WeakMap<PromptStats, NodeChoiceView>();

const TEMPLATE_SEND_NODE = "action_send_template";

export function sendsChoices(nodeType: string): boolean {
  return isInteractivePromptType(nodeType) || nodeType === TEMPLATE_SEND_NODE;
}

export function createChoiceStatsStore(): ChoiceStatsStore {
  return createValueStore<CanvasChoiceStats>(IDLE);
}

export const ChoiceStatsContext = createContext<ChoiceStatsStore | null>(null);

function viewOf(stats: PromptStats): NodeChoiceView {
  const known = views.get(stats);
  if (known) return known;
  const view: NodeChoiceView = { kind: "stats", stats };
  views.set(stats, view);
  return view;
}

export function nodeChoiceView(state: CanvasChoiceStats, nodeId: string): NodeChoiceView | null {
  if (state.result?.status !== "ready") return null;
  const stats = state.result.stats.nodes.get(nodeId);
  return stats ? viewOf(stats) : NO_SENDS;
}

function keptNodes(previous: CanvasChoiceStats, next: WorkflowChoiceStats): WorkflowChoiceStats {
  if (previous.result?.status !== "ready") return next;
  const before = previous.result.stats.nodes;
  const nodes = new Map<string, PromptStats>();
  for (const [nodeId, stats] of next.nodes) {
    const old = before.get(nodeId);
    nodes.set(nodeId, old && sameNodeChoiceStats(old, stats) ? old : stats);
  }
  return { ...next, nodes };
}

export function settleChoiceStats(previous: CanvasChoiceStats, answer: CanvasChoiceStatsResult): CanvasChoiceStats {
  if (answer.status !== "ready") return { loading: false, result: answer };
  return { loading: false, result: { status: "ready", stats: keptNodes(previous, answer.stats) } };
}

const NO_STORE = () => () => undefined;
const idle = () => IDLE;

export function useCanvasChoiceStats(): CanvasChoiceStats {
  const store = useContext(ChoiceStatsContext);
  return useSyncExternalStore(store?.subscribe ?? NO_STORE, store?.get ?? idle, store?.get ?? idle);
}

export function useNodeChoiceStats(nodeId: string, choiceNode = true): NodeChoiceView | null {
  const store = useContext(ChoiceStatsContext);
  const read = useCallback(() => (store && choiceNode ? nodeChoiceView(store.get(), nodeId) : null), [store, nodeId, choiceNode]);
  return useSyncExternalStore(store?.subscribe ?? NO_STORE, read, read);
}

export function useChoiceStatsLoader(store: ChoiceStatsStore, workflowId: string | null, period: PeriodPreset): () => void {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!workflowId) {
      store.set(IDLE);
      return;
    }
    let cancelled = false;
    store.set({ ...store.get(), loading: true });
    const range = presetRange(period);
    void getWorkflowChoiceStatsAction(workflowId, { from: range.dateFrom, to: range.dateTo }).then((answer) => {
      if (!cancelled) store.set(settleChoiceStats(store.get(), answer));
    });
    return () => {
      cancelled = true;
    };
  }, [store, workflowId, period, attempt]);
  return useCallback(() => setAttempt((count) => count + 1), []);
}
