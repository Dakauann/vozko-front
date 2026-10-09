import { GPU_FLAGS, keepBundle, mouse, withHarness, type Devtools } from "./harness";

const MOVES = 60;
const MOVE_PX = 4;
const MOVE_GAP_MS = 8;

const SCENARIOS = [
  { name: "drag 1 of 150 layers", layers: 150, selected: 1, budgetMs: 8 },
  { name: "drag 12 of 150 layers", layers: 150, selected: 12, budgetMs: 8 },
  { name: "drag 60 of 150 layers", layers: 150, selected: 60, budgetMs: 8 },
  { name: "drag 150 of 400 layers", layers: 400, selected: 150, budgetMs: 12 },
];

const BUDGET = { p95FrameMs: 20, revisionsPerDrag: 1 };

async function taskMs(page: Devtools): Promise<{ task: number; script: number }> {
  const { metrics } = (await page.send("Performance.getMetrics")) as { metrics: { name: string; value: number }[] };
  const value = (name: string) => (metrics.find((m) => m.name === name)?.value ?? 0) * 1000;
  return { task: value("TaskDuration"), script: value("ScriptDuration") };
}

interface MoveHooks {
  before: () => Promise<unknown>;
  after: () => Promise<unknown>;
  release?: boolean;
}

const NO_HOOKS: MoveHooks = { before: async () => undefined, after: async () => undefined };

async function drag(page: Devtools, scenario: (typeof SCENARIOS)[number], hooks: MoveHooks = NO_HOOKS) {
  const setup = await page.evaluate<{ anchor: { x: number; y: number }; scale: number }>(`harness.setup(${scenario.layers}, ${scenario.selected})`);
  const before = await page.evaluate<number[][]>(`harness.positions(${scenario.selected})`);
  const { x, y } = setup.anchor;
  await mouse(page, "mouseMoved", x, y, 0);
  await mouse(page, "mousePressed", x, y, 1);
  const revision = await page.evaluate<number>("harness.record()");
  if (!hooks.release) await hooks.before();
  const start = await taskMs(page);
  for (let i = 1; i <= MOVES; i++) {
    await mouse(page, "mouseMoved", x + i * MOVE_PX, y + i * (MOVE_PX / 2), 1);
    await Bun.sleep(MOVE_GAP_MS);
  }
  const end = await taskMs(page);
  if (!hooks.release) await hooks.after();
  if (hooks.release) await hooks.before();
  await mouse(page, "mouseReleased", x + MOVES * MOVE_PX, y + MOVES * (MOVE_PX / 2), 1);
  const frames = await page.evaluate<{ canvases: number; stacks: [string, number][]; frames: number; p50: number; p95: number; max: number; slow: number; revision: number }>("harness.stop()");
  if (process.env.STUDIO_PERF_CANVASES) console.log(scenario.name, "canvases created:", frames.canvases, JSON.stringify(frames.stacks, null, 1));
  if (hooks.release) await hooks.after();
  const after = await page.evaluate<number[][]>(`harness.positions(${scenario.selected})`);
  const expected = (MOVES * MOVE_PX) / setup.scale / 1080;
  const moved = after.every(([ax, ay], i) => Math.abs(ax - before[i][0] - expected) < 0.02 && Math.abs(ay - before[i][1] - expected / 2) < 0.02);
  return {
    scenario: scenario.name,
    taskMsPerMove: round((end.task - start.task) / MOVES),
    scriptMsPerMove: round((end.script - start.script) / MOVES),
    p50FrameMs: round(frames.p50),
    p95FrameMs: round(frames.p95),
    maxFrameMs: round(frames.max),
    slowFrames: frames.slow,
    revisionsPerDrag: frames.revision - revision,
    moved,
  };
}

interface ProfileNode {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
}

async function profiled(page: Devtools, scenario: (typeof SCENARIOS)[number]): Promise<void> {
  await page.send("Profiler.enable");
  await page.send("Profiler.setSamplingInterval", { interval: 200 });
  let stopped: Promise<Record<string, unknown>> = Promise.resolve({});
  await drag(page, scenario, { before: () => page.send("Profiler.start"), after: async () => (stopped = page.send("Profiler.stop")), release: process.env.STUDIO_PERF_RELEASE === "1" });
  const { profile } = (await stopped) as { profile: { nodes: ProfileNode[]; samples: number[]; timeDeltas: number[] } };
  const self = new Map<number, number>();
  profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
  const byFunction = new Map<string, number>();
  for (const node of profile.nodes) {
    const frame = node.callFrame;
    const name = `${frame.functionName || "(anonymous)"} ${frame.url.split("/").pop()}:${frame.lineNumber + 1}`;
    byFunction.set(name, (byFunction.get(name) ?? 0) + (self.get(node.id) ?? 0) / 1000);
  }
  console.log(`CPU profile, ${scenario.name}, self time in ms:`);
  for (const [name, ms] of [...byFunction.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`${ms.toFixed(1).padStart(8)}  ${name}`);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

const passed = await withHarness(async (harness) => {
  const { page } = harness;
  const focus = process.env.STUDIO_PERF_PROFILE;
  if (focus) {
    await profiled(page, SCENARIOS[Number(focus)] ?? SCENARIOS[0]);
    keepBundle(harness, process.env.STUDIO_PERF_BUNDLE);
    return true;
  }
  const results = [];
  for (const scenario of SCENARIOS) results.push(await drag(page, scenario));
  console.table(results);
  const verdicts = results.map((r, i) => [r.scenario, SCENARIOS[i].budgetMs, r.moved && r.taskMsPerMove <= SCENARIOS[i].budgetMs && r.p95FrameMs <= BUDGET.p95FrameMs && r.revisionsPerDrag <= BUDGET.revisionsPerDrag] as const);
  for (const [name, budget, ok] of verdicts) console.log(`${ok ? "PASS" : "FAIL"}  ${name} (budget: ${budget} ms of main thread per move, p95 frame ${BUDGET.p95FrameMs} ms, ${BUDGET.revisionsPerDrag} document revision per drag)`);
  if (GPU_FLAGS.includes("--use-angle=swiftshader")) console.log("Software GPU: frame times measure SwiftShader, not the editor.");
  return verdicts.every(([, , ok]) => ok);
});
process.exit(passed ? 0 : 1);
