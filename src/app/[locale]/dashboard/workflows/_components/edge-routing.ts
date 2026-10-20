import type { Node } from "@xyflow/react";

const MIN_OFFSET = 80;
const NODE_PAD = 40;
const MAX_LOOP_OVERHEAD = 180;
const COLLISION_PAD = 5;
const CELL_SIZE = 256;
const GROUP_NODE_TYPE = "groupNode";

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  r: number;
  b: number;
}

export interface Obstacle {
  id: string;
  order: number;
  bounds: Bounds;
}

interface Area {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ObstacleIndex {
  bounds: (id: string) => Bounds | undefined;
  within: (area: Area) => readonly Obstacle[];
  around: (x: number, y: number) => readonly Obstacle[];
}

export function nodeBounds(n: Node): Bounds {
  const x = n.position.x;
  const y = n.position.y;
  const w = n.measured?.width ?? (typeof n.width === "number" ? n.width : 220);
  const h =
    n.measured?.height ?? (typeof n.height === "number" ? n.height : 80);
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, r: x + w, b: y + h };
}

function obstaclesOf(nodes: readonly Node[]): {
  byId: Map<string, Bounds>;
  obstacles: Obstacle[];
} {
  const byId = new Map<string, Bounds>();
  const obstacles: Obstacle[] = [];
  nodes.forEach((node, order) => {
    const bounds = nodeBounds(node);
    byId.set(node.id, bounds);
    if (node.type !== GROUP_NODE_TYPE) obstacles.push({ id: node.id, order, bounds });
  });
  return { byId, obstacles };
}

export function flatObstacleIndex(nodes: readonly Node[]): ObstacleIndex {
  const { byId, obstacles } = obstaclesOf(nodes);
  return {
    bounds: (id) => byId.get(id),
    within: () => obstacles,
    around: () => obstacles,
  };
}

function cellOf(value: number): number {
  return Math.floor(value / CELL_SIZE);
}

function cellKey(column: number, row: number): string {
  return `${column}:${row}`;
}

export function buildObstacleIndex(nodes: readonly Node[]): ObstacleIndex {
  const { byId, obstacles } = obstaclesOf(nodes);
  const cells = new Map<string, Obstacle[]>();
  for (const obstacle of obstacles) {
    const { x, y, r, b } = obstacle.bounds;
    for (let column = cellOf(x - COLLISION_PAD); column <= cellOf(r + COLLISION_PAD); column++) {
      for (let row = cellOf(y - COLLISION_PAD); row <= cellOf(b + COLLISION_PAD); row++) {
        const key = cellKey(column, row);
        const bucket = cells.get(key);
        if (bucket) bucket.push(obstacle);
        else cells.set(key, [obstacle]);
      }
    }
  }
  return {
    bounds: (id) => byId.get(id),
    within: ({ left, top, right, bottom }) => {
      const found = new Set<Obstacle>();
      for (let column = cellOf(left); column <= cellOf(right); column++) {
        for (let row = cellOf(top); row <= cellOf(bottom); row++) {
          for (const obstacle of cells.get(cellKey(column, row)) ?? []) found.add(obstacle);
        }
      }
      return [...found].sort((a, z) => a.order - z.order);
    },
    around: (x, y) => cells.get(cellKey(cellOf(x), cellOf(y))) ?? [],
  };
}

export function cubicBezier(
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
  index: ObstacleIndex,
  skip: (id: string) => boolean,
): number {
  const pad = COLLISION_PAD;
  const hitsAt = (px: number, py: number) => {
    let hits = 0;
    for (const { id, bounds: b } of index.around(px, py)) {
      if (skip(id)) continue;
      if (px > b.x - pad && px < b.r + pad && py > b.y - pad && py < b.b + pad)
        hits++;
    }
    return hits;
  };
  let hits = 0;
  const step = 0.1;
  for (let t = step; t <= 1; t += step) {
    hits += hitsAt(
      cubicBezier(t, sx, exitX, exitX, midX),
      cubicBezier(t, sy, sy, loopY, loopY),
    );
    hits += hitsAt(
      cubicBezier(t, midX, entryX, entryX, tx),
      cubicBezier(t, loopY, loopY, ty, ty),
    );
  }
  return hits;
}

function forwardCurve(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  yBias: number,
): [path: string, labelX: number, labelY: number] {
  const off = Math.max((tx - sx) * 0.4, MIN_OFFSET);
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

export function plainPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): [path: string, labelX: number, labelY: number] {
  return forwardCurve(sx, sy, tx, ty, 0);
}

export function computePath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  index: ObstacleIndex,
  sourceId: string,
  targetId: string,
): [path: string, labelX: number, labelY: number] {
  const dx = tx - sx;
  const skip = (id: string) => id === sourceId || id === targetId;

  const srcB = index.bounds(sourceId) ?? null;
  const tgtB = index.bounds(targetId) ?? null;

  if (dx >= 50) {
    const corrLeft = sx + 20;
    const corrRight = tx - 20;
    const corrTop = Math.min(sy, ty) - NODE_PAD;
    const corrBot = Math.max(sy, ty) + NODE_PAD;

    let yBias = 0;
    for (const { id, bounds: b } of index.within({
      left: corrLeft,
      top: corrTop,
      right: corrRight,
      bottom: corrBot,
    })) {
      if (skip(id)) continue;
      const hHit = b.r > corrLeft && b.x < corrRight;
      const vHit = b.b > corrTop && b.y < corrBot;
      if (hHit && vHit) {
        const dir = (sy + ty) / 2 >= b.cy ? 1 : -1;
        yBias += dir * (b.h / 2 + NODE_PAD);
      }
    }

    return forwardCurve(sx, sy, tx, ty, yBias);
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

  for (const { id, bounds: b } of index.within({
    left: scanLeft,
    top: midY - vWindow,
    right: scanRight,
    bottom: midY + vWindow,
  })) {
    if (skip(id)) continue;
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

  const midX = (exitX + entryX) / 2;

  const aboveHits = countCollisions(sx, sy, exitX, aboveY, midX, entryX, ty, tx, index, skip);
  const belowHits = countCollisions(sx, sy, exitX, belowY, midX, entryX, ty, tx, index, skip);

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
