import { GPU_FLAGS, keepBundle, mouse, withHarness, type Devtools } from "./harness";
import { HEAVY_HARNESS, profileHeavy, runHeavy } from "./heavy";
import { mainThread, printProfile, profileDuring, round } from "./metrics";

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

const HEAVY_FOCUS = "heavy:";
const HEAVY_ONLY = "heavy";

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
  const start = await mainThread(page);
  for (let i = 1; i <= MOVES; i++) {
    await mouse(page, "mouseMoved", x + i * MOVE_PX, y + i * (MOVE_PX / 2), 1);
    await Bun.sleep(MOVE_GAP_MS);
  }
  const end = await mainThread(page);
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

async function profiled(page: Devtools, scenario: (typeof SCENARIOS)[number]): Promise<void> {
  const profile = await profileDuring(page, async (start, stop) => void (await drag(page, scenario, { before: start, after: stop, release: process.env.STUDIO_PERF_RELEASE === "1" })));
  printProfile(scenario.name, profile);
}

const passed = await withHarness(async (harness) => {
  const { page } = harness;
  const focus = process.env.STUDIO_PERF_PROFILE;
  if (focus?.startsWith(HEAVY_FOCUS)) {
    await profileHeavy(page, Number(focus.slice(HEAVY_FOCUS.length)));
    keepBundle(harness, process.env.STUDIO_PERF_BUNDLE);
    return true;
  }
  if (focus) {
    await profiled(page, SCENARIOS[Number(focus)] ?? SCENARIOS[0]);
    keepBundle(harness, process.env.STUDIO_PERF_BUNDLE);
    return true;
  }
  if (process.argv[2] === HEAVY_ONLY) return runHeavy(page);
  const results = [];
  for (const scenario of SCENARIOS) results.push(await drag(page, scenario));
  console.table(results);
  const verdicts = results.map((r, i) => [r.scenario, SCENARIOS[i].budgetMs, r.moved && r.taskMsPerMove <= SCENARIOS[i].budgetMs && r.p95FrameMs <= BUDGET.p95FrameMs && r.revisionsPerDrag <= BUDGET.revisionsPerDrag] as const);
  for (const [name, budget, ok] of verdicts) console.log(`${ok ? "PASS" : "FAIL"}  ${name} (budget: ${budget} ms of main thread per move, p95 frame ${BUDGET.p95FrameMs} ms, ${BUDGET.revisionsPerDrag} document revision per drag)`);
  const heavy = await runHeavy(page);
  if (GPU_FLAGS.includes("--use-angle=swiftshader")) console.log("Software GPU: frame times measure SwiftShader, not the editor.");
  return verdicts.every(([, , ok]) => ok) && heavy;
}, HEAVY_HARNESS);
process.exit(passed ? 0 : 1);
