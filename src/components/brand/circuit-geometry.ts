export type CircuitPoint = readonly [number, number];
export type CircuitRoute = { points: CircuitPoint[]; phase: number; depth: number };
export type CircuitParameters = {
  seed?: number;
  width?: number;
  height?: number;
  branches?: number;
  steps?: number;
};

/** Reproducible when seeded; bounded geometry with orthogonal and 45° routes. */
export function createCircuitRoutes({ seed = 17, width = 220, height = 220, branches = 8, steps = 5 }: CircuitParameters = {}): CircuitRoute[] {
  let state = seed >>> 0;
  const random = () => {
    state += 0x6d2b79f5;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
  const count = Math.max(1, Math.min(32, Math.round(branches)));
  const segments = Math.max(2, Math.min(10, Math.round(steps)));
  const inset = Math.min(width, height) * 0.04;
  const clampX = (x: number) => Math.max(inset, Math.min(width - inset, x));
  const clampY = (y: number) => Math.max(inset, Math.min(height - inset, y));
  const routes: CircuitRoute[] = [];
  for (let index = 0; index < count; index++) {
    const parent = index > 1 ? routes[Math.floor(random() * routes.length)] : undefined;
    const origin = parent
      ? parent.points[Math.floor(random() * (parent.points.length - 1))]
      : [width * (index === 0 ? 0.12 : 0.82), height * 0.94] as const;
    const points: CircuitPoint[] = [origin];
    const direction = random() > 0.5 ? 1 : -1;
    let [x, y] = origin;
    for (let step = 0; step < segments; step++) {
      const run = Math.min(width, height) * (0.08 + random() * 0.13);
      const nextX = clampX(x + direction * run);
      if (step % 2 === 0) {
        points.push([nextX, y]);
        x = nextX;
      } else {
        const rise = Math.min(run, y - inset, direction > 0 ? width - inset - x : x - inset);
        x += direction * Math.max(0, rise);
        y = clampY(y - Math.max(0, rise));
        points.push([x, y]);
        y = clampY(y - run);
        points.push([x, y]);
      }
    }
    routes.push({ points, phase: random(), depth: random() * 2 - 1 });
  }
  return routes;
}

export function circuitPath(points: readonly CircuitPoint[]) {
  return points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
}
