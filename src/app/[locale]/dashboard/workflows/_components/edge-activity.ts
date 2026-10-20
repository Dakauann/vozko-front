import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import type { Edge } from "@xyflow/react";

import { createValueStore, type ValueStore } from "./value-store";

export type HoverStore = ValueStore<string | null>;

export function createHoverStore(): HoverStore {
  return createValueStore<string | null>(null);
}

export const HoveredNodeContext = createContext<HoverStore | null>(null);

const NO_HOVER = () => () => undefined;

interface EdgeFlowInput {
  touchesHovered: boolean;
  endpointSelected: boolean;
  data: Record<string, unknown> | undefined;
}

export function edgeTouches(nodeId: string | null, source: string, target: string): boolean {
  return nodeId !== null && (nodeId === source || nodeId === target);
}

export function isEdgeFlowing({ touchesHovered, endpointSelected, data }: EdgeFlowInput): boolean {
  return isEdgeTraversed(data) || endpointSelected || touchesHovered;
}

export function withFlowingPath(edges: readonly Edge[], edgeIds: ReadonlySet<string>): Edge[] {
  return edges.map((edge) => (edgeIds.has(edge.id) ? { ...edge, data: { ...(edge.data ?? {}), flowing: true } } : edge));
}

interface RunPathMarks {
  flowing?: Edge;
  dimmed?: Edge;
}

const runPathMarks = new WeakMap<Edge, RunPathMarks>();

function markedEdge(edge: Edge, traversed: boolean): Edge {
  const marks = runPathMarks.get(edge) ?? {};
  const known = traversed ? marks.flowing : marks.dimmed;
  if (known) return known;
  const marked = { ...edge, data: { ...(edge.data ?? {}), ...(traversed ? { flowing: true } : { runDim: true }) } };
  runPathMarks.set(edge, traversed ? { ...marks, flowing: marked } : { ...marks, dimmed: marked });
  return marked;
}

export function withRunPath(edges: readonly Edge[], traversedIds: ReadonlySet<string>): Edge[] {
  return edges.map((edge) => markedEdge(edge, traversedIds.has(edge.id)));
}

export function isEdgeTraversed(data: Record<string, unknown> | undefined): boolean {
  return data?.flowing === true;
}

export function isEdgeDimmed(data: Record<string, unknown> | undefined): boolean {
  return data?.runDim === true;
}

export function useHoverTouches(source: string, target: string): boolean {
  const hover = useContext(HoveredNodeContext);
  const readTouches = useCallback(() => edgeTouches(hover?.get() ?? null, source, target), [hover, source, target]);
  return useSyncExternalStore(hover?.subscribe ?? NO_HOVER, readTouches, readTouches);
}
