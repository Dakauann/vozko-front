import { useMemo } from "react";
import { useStore, type ReactFlowState } from "@xyflow/react";
import { shallow } from "zustand/shallow";

import type { HandleDefinition, WorkflowNodeType } from "@/lib/workflows/types";

export const FULL_DETAIL_ZOOM = 0.6;
export const MINIMAL_DETAIL_ZOOM = 0.3;
export const EDGE_LABEL_MIN_ZOOM = 0.5;

export type DetailTier = "full" | "simplified" | "minimal";

const DEFAULT_HANDLE = "default";

export const MESSAGE_NODE_TYPES: ReadonlySet<string> = new Set<WorkflowNodeType>([
  "action_send_text",
  "action_send_email",
  "action_send_template",
  "action_send_media",
]);

export function labelsOutputsOnNode(nodeType: string | undefined): boolean {
  return nodeType !== undefined && !MESSAGE_NODE_TYPES.has(nodeType);
}

export function detailTierAt(zoom: number): DetailTier {
  if (zoom >= FULL_DETAIL_ZOOM) return "full";
  return zoom >= MINIMAL_DETAIL_ZOOM ? "simplified" : "minimal";
}

export function detailTierSelector(state: ReactFlowState): DetailTier {
  return detailTierAt(state.transform[2]);
}

export type CompactTier = Exclude<DetailTier, "full">;

export const COMPACT_HEADER_PX: Record<CompactTier, number> = { simplified: 36, minimal: 48 };
export const SUMMARY_LINE_PX = 18;
const SUMMARY_HEADING_PX = 20;
const SUMMARY_PADDING_PX = 16;
const BRANCH_LABEL_CLEARANCE_PX = 14;

export function compactContentHeight(tier: CompactTier, measuredHeight: number, branchTops: readonly number[]): number {
  const limit = tier === "simplified" && branchTops.length > 0 ? Math.min(...branchTops) - BRANCH_LABEL_CLEARANCE_PX : measuredHeight;
  return Math.max(0, limit - COMPACT_HEADER_PX[tier]);
}

export function summaryLineCount(height: number, hasHeading: boolean): number {
  const room = height - SUMMARY_PADDING_PX - (hasHeading ? SUMMARY_HEADING_PX : 0);
  return Math.max(0, Math.floor(room / SUMMARY_LINE_PX));
}

export function edgeLabelsSelector(state: ReactFlowState): boolean {
  return state.transform[2] >= EDGE_LABEL_MIN_ZOOM;
}

const NO_OUTPUTS: HandleDefinition[] = [];

export function edgeEndpointsSelector(source: string, target: string) {
  return (state: ReactFlowState) => {
    const from = state.nodeLookup.get(source);
    const to = state.nodeLookup.get(target);
    const fromData = from?.data as { outputs?: HandleDefinition[]; nodeType?: string } | undefined;
    return {
      endpointDragging: from?.dragging === true || to?.dragging === true,
      endpointSelected: from?.selected === true || to?.selected === true,
      outputs: fromData?.outputs ?? NO_OUTPUTS,
      outputsLabelled: labelsOutputsOnNode(fromData?.nodeType),
      labelsVisible: edgeLabelsSelector(state),
    };
  };
}

export function useEdgeEndpoints(source: string, target: string) {
  const selector = useMemo(() => edgeEndpointsSelector(source, target), [source, target]);
  return useStore(selector, shallow);
}

export function nodeDetailSelector(id: string) {
  return (state: ReactFlowState) => {
    const node = state.nodeLookup.get(id);
    return {
      tier: detailTierSelector(state),
      measuredHeight: node?.measured.height,
      measuredHandles: node?.internals.handleBounds?.source,
    };
  };
}

export function useNodeDetail(id: string) {
  const selector = useMemo(() => nodeDetailSelector(id), [id]);
  return useStore(selector, shallow);
}

export function edgeLabelHandle(label: unknown, outputs: readonly HandleDefinition[], outputsLabelled: boolean): string | null {
  if (typeof label !== "string" || label.trim() === "") return null;
  if (label.trim().toLowerCase() === DEFAULT_HANDLE && outputs.length <= 1) return null;
  if (outputsLabelled && outputs.some((output) => output.id === label && output.label)) return null;
  return label;
}

interface MeasuredHandle {
  id?: string | null;
  y: number;
  height: number;
}

export function handleCenters(
  branchIds: readonly string[],
  handles: readonly MeasuredHandle[] | null | undefined,
): Record<string, number> | null {
  if (branchIds.length === 0) return {};
  if (!handles) return null;
  const centers: Record<string, number> = {};
  for (const id of branchIds) {
    const handle = handles.find((candidate) => candidate.id === id);
    if (!handle) return null;
    centers[id] = handle.y + handle.height / 2;
  }
  return centers;
}

const PAN_START_EVENTS = new Set(["mousedown", "pointerdown", "touchstart"]);

export function isPanGesture(
  event: { type: string; touches?: { length: number } } | null,
): boolean {
  if (!event || !PAN_START_EVENTS.has(event.type)) return false;
  return (event.touches?.length ?? 1) === 1;
}
