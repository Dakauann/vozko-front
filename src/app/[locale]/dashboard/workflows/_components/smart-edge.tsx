"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  type EdgeProps,
  type ConnectionLineComponentProps,
  type Node,
} from "@xyflow/react";
import { useMemo } from "react";
import type { HandleDefinition, WorkflowNodeType } from "@/lib/workflows/types";

const DOT_PATTERN_STYLE = {
  backgroundImage:
    "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.22) 1px, transparent 0), radial-gradient(circle at 1px 1px, rgba(15,23,42,0.07) 1px, transparent 0)",
  backgroundPosition: "0 0, 4px 4px",
  backgroundSize: "8px 8px",
} as const;

const MIN_OFFSET = 80;
const NODE_PAD = 40;
const MAX_LOOP_OVERHEAD = 180;


interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  r: number;
  b: number;
}

function nodeBounds(n: Node): Bounds {
  const x = n.position.x;
  const y = n.position.y;
  const w = n.measured?.width ?? (typeof n.width === "number" ? n.width : 220);
  const h =
    n.measured?.height ?? (typeof n.height === "number" ? n.height : 80);
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, r: x + w, b: y + h };
}

function findNode(nodes: Node[], id: string): Node | undefined {
  return nodes.find((n) => n.id === id);
}

function resolveEdgeLabel(
  sourceNode: Node | undefined,
  rawLabel: string,
): { text: string; className: string } {
  const outputs = (
    sourceNode?.data as { outputs?: HandleDefinition[] } | undefined
  )?.outputs;
  const output = outputs?.find((item) => item.id === rawLabel);
  const outputId = rawLabel.trim().toLowerCase();
  const outputIndex = outputs?.findIndex((item) => item.id === rawLabel) ?? -1;
  const total = outputs?.length ?? 0;
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
        "border-slate-200/70 bg-background text-muted-foreground dark:border-slate-500/20 dark:bg-background dark:text-muted-foreground",
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

function cubicBezier(
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number,
): number {
  const u = 1 - t;
  return (
    u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
  );
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function countCollisions(
  sx: number,
  sy: number,
  exitX: number,
  loopY: number,
  midX: number,
  entryX: number,
  ty: number,
  tx: number,
  obstacles: Bounds[],
  pad: number,
): number {
  let hits = 0;
  const step = 0.1;
  for (let t = step; t <= 1; t += step) {
    const px1 = cubicBezier(t, sx, exitX, exitX, midX);
    const py1 = cubicBezier(t, sy, sy, loopY, loopY);
    const px2 = cubicBezier(t, midX, entryX, entryX, tx);
    const py2 = cubicBezier(t, loopY, loopY, ty, ty);
    for (const b of obstacles) {
      if (
        px1 > b.x - pad &&
        px1 < b.r + pad &&
        py1 > b.y - pad &&
        py1 < b.b + pad
      )
        hits++;
      if (
        px2 > b.x - pad &&
        px2 < b.r + pad &&
        py2 > b.y - pad &&
        py2 < b.b + pad
      )
        hits++;
    }
  }
  return hits;
}


function computePath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  nodes: Node[],
  sourceId: string,
  targetId: string,
): [path: string, labelX: number, labelY: number] {
  const dx = tx - sx;

  const srcNode = findNode(nodes, sourceId);
  const tgtNode = findNode(nodes, targetId);
  const srcB = srcNode ? nodeBounds(srcNode) : null;
  const tgtB = tgtNode ? nodeBounds(tgtNode) : null;

  if (dx >= 50) {
    const off = Math.max(dx * 0.4, MIN_OFFSET);

    const corrLeft = sx + 20;
    const corrRight = tx - 20;
    const corrTop = Math.min(sy, ty) - NODE_PAD;
    const corrBot = Math.max(sy, ty) + NODE_PAD;

    let yBias = 0;
    for (const n of nodes) {
      if (n.id === sourceId || n.id === targetId || n.type === "groupNode")
        continue;
      const b = nodeBounds(n);
      const hHit = b.r > corrLeft && b.x < corrRight;
      const vHit = b.b > corrTop && b.y < corrBot;
      if (hHit && vHit) {
        const dir = (sy + ty) / 2 >= b.cy ? 1 : -1;
        yBias += dir * (b.h / 2 + NODE_PAD);
      }
    }

    if (yBias !== 0) {
      const c1x = sx + off,
        c1y = sy + yBias,
        c2x = tx - off,
        c2y = ty + yBias;
      const path = `M ${sx},${sy} C ${c1x},${c1y} ${c2x},${c2y} ${tx},${ty}`;
      const lt = 0.25;
      const lx = cubicBezier(lt, sx, c1x, c2x, tx);
      const ly = cubicBezier(lt, sy, c1y, c2y, ty);
      return [path, lx, ly];
    }

    const c1x = sx + off,
      c1y = sy,
      c2x = tx - off,
      c2y = ty;
    const path = `M ${sx},${sy} C ${c1x},${c1y} ${c2x},${c2y} ${tx},${ty}`;
    const lt = 0.25;
    const lx = cubicBezier(lt, sx, c1x, c2x, tx);
    const ly = cubicBezier(lt, sy, c1y, c2y, ty);
    return [path, lx, ly];
  }


  const dy = ty - sy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const adaptPad = clamp(dist * 0.12 + 20, 25, 60);

  const exitX = (srcB ? srcB.r : sx) + adaptPad;
  const entryX = (tgtB ? tgtB.x : tx) - adaptPad;

  const scanLeft = Math.min(srcB ? srcB.x : sx, tgtB ? tgtB.x : tx) - 10;
  const scanRight = Math.max(srcB ? srcB.r : sx, tgtB ? tgtB.r : tx) + 10;

  let topBound = Math.min(srcB ? srcB.y : sy, tgtB ? tgtB.y : ty);
  let botBound = Math.max(srcB ? srcB.b : sy, tgtB ? tgtB.b : ty);

  const midY = (sy + ty) / 2;
  const vWindow = Math.abs(sy - ty) + 250;

  for (const n of nodes) {
    if (n.id === sourceId || n.id === targetId || n.type === "groupNode")
      continue;
    const b = nodeBounds(n);
    if (b.r <= scanLeft || b.x >= scanRight) continue;
    if (b.cy < midY - vWindow || b.cy > midY + vWindow) continue;
    topBound = Math.min(topBound, b.y);
    botBound = Math.max(botBound, b.b);
  }

  const maxLoop = Math.max(120, Math.abs(sy - ty) + MAX_LOOP_OVERHEAD);
  const capTop = Math.min(sy, ty) - maxLoop;
  const capBot = Math.max(sy, ty) + maxLoop;

  const aboveY = Math.max(topBound - adaptPad, capTop);
  const belowY = Math.min(botBound + adaptPad, capBot);

  const obstacles: Bounds[] = [];
  for (const n of nodes) {
    if (n.id === sourceId || n.id === targetId || n.type === "groupNode")
      continue;
    obstacles.push(nodeBounds(n));
  }

  const midX = (exitX + entryX) / 2;

  const aboveHits = countCollisions(
    sx,
    sy,
    exitX,
    aboveY,
    midX,
    entryX,
    ty,
    tx,
    obstacles,
    5,
  );
  const belowHits = countCollisions(
    sx,
    sy,
    exitX,
    belowY,
    midX,
    entryX,
    ty,
    tx,
    obstacles,
    5,
  );

  const aboveCost = Math.abs(sy - aboveY) + Math.abs(aboveY - ty);
  const belowCost = Math.abs(sy - belowY) + Math.abs(belowY - ty);

  let loopY: number;
  if (aboveHits < belowHits) {
    loopY = aboveY;
  } else if (belowHits < aboveHits) {
    loopY = belowY;
  } else {
    loopY = aboveCost <= belowCost ? aboveY : belowY;
  }

  const path = [
    `M ${sx},${sy}`,
    `C ${exitX},${sy} ${exitX},${loopY} ${midX},${loopY}`,
    `C ${entryX},${loopY} ${entryX},${ty} ${tx},${ty}`,
  ].join(" ");

  const lt = 0.3;
  const labelX = cubicBezier(lt, sx, exitX, exitX, midX);
  const labelY = cubicBezier(lt, sy, sy, loopY, loopY);

  return [path, labelX, labelY];
}


export function SmartBezierEdge({
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
  data,
}: EdgeProps) {
  const { getNodes } = useReactFlow();
  // When the copilot adds a connection, draw it in with a small stagger (the
  // same sequential reveal as added nodes). Existing edges have no _appearSeq.
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
  const nodes = getNodes();
  const sourceNode = findNode(nodes, source);

  const nodesFingerprint = nodes
    .map(
      (n) =>
        `${n.id}:${n.position.x},${n.position.y},${n.measured?.width ?? n.width ?? 0},${n.measured?.height ?? n.height ?? 0}`,
    )
    .join("|");

  const [path, labelX, labelY] = useMemo(
    () =>
      computePath(sourceX, sourceY, targetX, targetY, nodes, source, target),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sourceX, sourceY, targetX, targetY, source, target, nodesFingerprint],
  );

  const resolvedLabel = useMemo(() => {
    if (!label || typeof label !== "string") return null;
    return resolveEdgeLabel(sourceNode, label);
  }, [label, sourceNode]);

  return (
    <>
      <g style={appearStyle}>
        <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
        {/* Flowing dot animation overlay */}
        <path
          d={path}
          fill="none"
          strokeWidth={1.5}
          stroke="hsl(var(--muted-foreground)/0.35)"
          strokeDasharray="6 14"
          className="react-flow__edge-interaction"
          style={{
            animation: "smartEdgeFlow 1s linear infinite",
            pointerEvents: "none",
          }}
        />
      </g>
      {resolvedLabel && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            <span
              className={`inline-flex rounded-[--radius] border px-2 py-0.5 text-[11px] font-semibold shadow-sm ${resolvedLabel.className}`}
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


export function SmartConnectionLine({
  fromX,
  fromY,
  fromNode,
  toX,
  toY,
}: ConnectionLineComponentProps) {
  const { getNodes } = useReactFlow();

  const [d] = computePath(
    fromX,
    fromY,
    toX,
    toY,
    getNodes(),
    fromNode?.id ?? "__drag_source__",
    "__drag_target__",
  );

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke="hsl(var(--muted-foreground)/0.5)"
        strokeWidth={1.5}
        strokeDasharray="6 3"
      />
      <circle cx={toX} cy={toY} r={4} fill="hsl(var(--muted-foreground)/0.5)" />
    </g>
  );
}
