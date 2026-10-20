"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  type EdgeProps,
  type ConnectionLineComponentProps,
} from "@xyflow/react";
import { createContext, memo, useContext, useMemo } from "react";
import type { HandleDefinition } from "@/lib/workflows/types";
import { cn } from "@/lib/utils";

import {
  buildObstacleIndex,
  computePath,
  plainPath,
  type ObstacleIndex,
} from "./edge-routing";
import { edgeLabelHandle, useEdgeEndpoints } from "./canvas-detail";
import { isEdgeDimmed, isEdgeFlowing, isEdgeTraversed, useHoverTouches } from "./edge-activity";

const DOT_PATTERN_STYLE = {
  backgroundImage:
    "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.22) 1px, transparent 0), radial-gradient(circle at 1px 1px, rgba(15,23,42,0.07) 1px, transparent 0)",
  backgroundPosition: "0 0, 4px 4px",
  backgroundSize: "8px 8px",
} as const;

export const ObstacleIndexContext = createContext<ObstacleIndex | null>(null);

function useObstacleIndex(): () => ObstacleIndex {
  const shared = useContext(ObstacleIndexContext);
  const { getNodes } = useReactFlow();
  return useMemo(
    () => (shared ? () => shared : () => buildObstacleIndex(getNodes())),
    [shared, getNodes],
  );
}

function resolveEdgeLabel(
  outputs: HandleDefinition[],
  rawLabel: string,
): { text: string; className: string } {
  const output = outputs.find((item) => item.id === rawLabel);
  const outputId = rawLabel.trim().toLowerCase();
  const outputIndex = outputs.findIndex((item) => item.id === rawLabel);
  const total = outputs.length;
  const isDefault = outputId === "default";
  const isError = outputId === "erro" || outputId === "error";
  const isFirst = outputIndex === 0;
  const isLast = outputIndex === total - 1;

  if (isError) {
    return {
      text: output?.label ?? rawLabel,
      className:
        "border-destructive bg-destructive text-destructive-foreground dark:border-destructive dark:bg-destructive dark:text-destructive-foreground",
    };
  }

  if (isDefault) {
    return {
      text: output?.label ?? rawLabel,
      className:
        "border-border bg-background text-muted-foreground",
    };
  }

  if (isFirst) {
    return {
      text: output?.label ?? rawLabel,
      className:
        "border-healthy bg-healthy text-healthy-foreground dark:border-healthy dark:bg-healthy dark:text-healthy-foreground",
    };
  }

  if (isLast) {
    return {
      text: output?.label ?? rawLabel,
      className:
        "border-destructive bg-destructive text-destructive-foreground dark:border-destructive dark:bg-destructive dark:text-destructive-foreground",
    };
  }

  return {
    text: output?.label ?? rawLabel,
    className:
      "border-info bg-muted text-muted-foreground dark:border-info dark:bg-muted dark:text-white",
  };
}

function SmartBezierEdgeComponent({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  label,
  markerEnd,
  style,
  selected,
  data,
}: EdgeProps) {
  const obstacles = useObstacleIndex();
  const { endpointDragging, endpointSelected, outputs, outputsLabelled, labelsVisible } =
    useEdgeEndpoints(source, target);
  const touchesHovered = useHoverTouches(source, target);
  const flowing = isEdgeFlowing({ touchesHovered, endpointSelected, data });
  const appearSeq =
    data && typeof (data as { _appearSeq?: unknown })._appearSeq === "number"
      ? (data as { _appearSeq: number })._appearSeq
      : null;
  const appearStyle =
    appearSeq != null
      ? {
          animation: "wfEdgeIn 0.32s ease-out both",
          animationDelay: `${0.12 + appearSeq * 0.05}s`,
        }
      : undefined;

  const [path, labelX, labelY] = useMemo(
    () =>
      endpointDragging
        ? plainPath(sourceX, sourceY, targetX, targetY)
        : computePath(sourceX, sourceY, targetX, targetY, obstacles(), source, target),
    [endpointDragging, sourceX, sourceY, targetX, targetY, obstacles, source, target],
  );

  const labelHandle = edgeLabelHandle(label, outputs, outputsLabelled);
  const resolvedLabel = useMemo(
    () => (labelHandle && labelsVisible ? resolveEdgeLabel(outputs, labelHandle) : null),
    [labelHandle, labelsVisible, outputs],
  );

  const traversed = isEdgeTraversed(data);
  const dimmed = isEdgeDimmed(data);
  const edgeStyle = {
    ...style,
    stroke: selected || traversed ? "hsl(var(--primary))" : "hsl(var(--border-strong))",
    strokeWidth: selected || traversed ? 2.5 : 2,
  };

  return (
    <>
      <g style={appearStyle} className={cn(dimmed && "opacity-25")}>
        <BaseEdge id={id} path={path} markerEnd={markerEnd} style={edgeStyle} />
        <path
          d={path}
          fill="none"
          strokeWidth={1.5}
          stroke={
            selected
              ? "hsl(var(--primary-foreground)/0.4)"
              : "hsl(var(--muted-foreground)/0.35)"
          }
          strokeDasharray="6 14"
          className={cn("react-flow__edge-interaction", flowing && "wf-edge-flow")}
          style={{ pointerEvents: "none" }}
        />
      </g>
      {resolvedLabel && (
        <EdgeLabelRenderer>
          <div
            className={cn("nodrag nopan pointer-events-none absolute", dimmed && "opacity-25")}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            <span
              className={`inline-flex rounded-[--radius] border px-2 py-0.5 text-2xs font-semibold shadow-sm ${resolvedLabel.className}`}
              style={DOT_PATTERN_STYLE}
            >
              {resolvedLabel.text}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const SmartBezierEdge = memo(SmartBezierEdgeComponent);

export function SmartConnectionLine({
  fromX,
  fromY,
  fromNode,
  toX,
  toY,
}: ConnectionLineComponentProps) {
  const obstacles = useObstacleIndex();

  const [d] = computePath(
    fromX,
    fromY,
    toX,
    toY,
    obstacles(),
    fromNode?.id ?? "__drag_source__",
    "__drag_target__",
  );

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        strokeDasharray="6 3"
      />
      <rect
        x={toX - 4.5}
        y={toY - 4.5}
        width={9}
        height={9}
        rx={2}
        fill="hsl(var(--card))"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
      />
    </g>
  );
}
