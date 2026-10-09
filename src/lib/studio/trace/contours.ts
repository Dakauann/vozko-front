import type { Point } from "../viewport";

const DIRECTIONS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

function inside(classes: Int16Array, width: number, height: number, cls: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height && classes[y * width + x] === cls;
}

export function maskLoops(classes: Int16Array, width: number, height: number, cls: number): Point[][] {
  const stride = width + 1;
  const vertexCount = stride * (height + 1);
  const first = new Int32Array(vertexCount).fill(-1);
  const from: number[] = [];
  const direction: number[] = [];
  const nextAtVertex: number[] = [];
  const add = (x: number, y: number, dir: number) => {
    const vertex = y * stride + x;
    from.push(vertex);
    direction.push(dir);
    nextAtVertex.push(first[vertex]);
    first[vertex] = from.length - 1;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (classes[y * width + x] !== cls) continue;
      if (!inside(classes, width, height, cls, x, y - 1)) add(x, y, 0);
      if (!inside(classes, width, height, cls, x + 1, y)) add(x + 1, y, 1);
      if (!inside(classes, width, height, cls, x, y + 1)) add(x + 1, y + 1, 2);
      if (!inside(classes, width, height, cls, x - 1, y)) add(x, y + 1, 3);
    }
  }
  const used = new Uint8Array(from.length);
  const loops: Point[][] = [];
  const pick = (vertex: number, heading: number): number => {
    let best = -1;
    let bestRank = 9;
    for (let edge = first[vertex]; edge >= 0; edge = nextAtVertex[edge]) {
      if (used[edge]) continue;
      const turn = (direction[edge] - heading + 4) % 4;
      const rank = turn === 1 ? 0 : turn === 0 ? 1 : turn === 3 ? 2 : 3;
      if (rank < bestRank) {
        bestRank = rank;
        best = edge;
      }
    }
    return best;
  };
  for (let start = 0; start < from.length; start++) {
    if (used[start]) continue;
    const loop: Point[] = [];
    let edge = start;
    let lastDirection = -1;
    while (edge >= 0 && !used[edge]) {
      used[edge] = 1;
      const vertex = from[edge];
      if (direction[edge] !== lastDirection) loop.push({ x: vertex % stride, y: Math.floor(vertex / stride) });
      lastDirection = direction[edge];
      const [dx, dy] = DIRECTIONS[direction[edge]];
      const end = vertex + dy * stride + dx;
      edge = pick(end, direction[edge]);
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}
