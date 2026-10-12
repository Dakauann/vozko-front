import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { SNAP_THRESHOLD_SCREEN_PX } from "@/lib/studio/snapping";

import { writeHeavyFixtures } from "./fixtures";
import { mouse, type Devtools, type HarnessOptions } from "./harness";
import { gcDuring, mainThread, printProfile, printTimeline, profileDuring, round, TIMELINE_CATEGORIES, traceDuring } from "./metrics";

const MOVES = 60;
const MOVE_GAP_MS = 8;
const DRAG_STEP = { x: -3, y: 1.5 };
const PAN_STEP = { x: 6, y: 4 };
const ZOOM_STEP = -8;
const DEEP_ZOOM_STEP = -11;
const MIN_ZOOM_GAIN = 1.2;
const EXACT_MOVES = 20;
const CACHE_TOLERANCE = 2;
const CACHED_FRAME_DRAWS = 24;
const CAPTURE_ATTEMPTS = 5;
const DRAG_TARGETS: DragTarget[] = ["small", "header", "multi"];
const CTRL = 2;
const TOP_RENDERS = 6;
const REPEATS = 3;

type DragTarget = "small" | "header" | "multi";

type Gesture = { kind: "drag"; target: DragTarget } | { kind: "pan" } | { kind: "zoom" };

interface HeavyBudget {
  taskMsPerMove: number;
  p95FrameMs: number;
  commitsPerMove: number;
  canvasesPerMove: number;
  uploadsPerMove: number;
  drawCallsPerMove: number;
  passesPerMove: number;
  releaseMs: number;
  revisions: number;
}

interface HeavyScenario {
  name: string;
  gesture: Gesture;
  budget: HeavyBudget;
}

const STILL_FRAME = { p95FrameMs: 20, commitsPerMove: 0.1, canvasesPerMove: 0, uploadsPerMove: 0.1 };
const DRAG_BUDGET = { ...STILL_FRAME, taskMsPerMove: 8, releaseMs: 80, revisions: 1 };
const VIEW_BUDGET = { ...STILL_FRAME, taskMsPerMove: 8, commitsPerMove: 1, releaseMs: 0, revisions: 0 };

const HEAVY_SCENARIOS: HeavyScenario[] = [
  { name: "heavy: drag small label", gesture: { kind: "drag", target: "small" }, budget: { ...DRAG_BUDGET, drawCallsPerMove: 16, passesPerMove: 8 } },
  { name: "heavy: drag header photo", gesture: { kind: "drag", target: "header" }, budget: { ...DRAG_BUDGET, drawCallsPerMove: 16, passesPerMove: 8 } },
  { name: "heavy: drag 14 selected", gesture: { kind: "drag", target: "multi" }, budget: { ...DRAG_BUDGET, drawCallsPerMove: 24, passesPerMove: 16 } },
  { name: "heavy: pan", gesture: { kind: "pan" }, budget: { ...VIEW_BUDGET, drawCallsPerMove: 40, passesPerMove: 32 } },
  { name: "heavy: zoom", gesture: { kind: "zoom" }, budget: { ...VIEW_BUDGET, taskMsPerMove: 12, drawCallsPerMove: 40, passesPerMove: 32 } },
];

export const HEAVY_HARNESS: Pick<HarnessOptions, "fixtures" | "overrides"> = {
  fixtures: writeHeavyFixtures,
  overrides: { "@/app/actions/medias": join(import.meta.dir, "stubs/medias.ts") },
};

interface Stopped {
  commits: Record<string, number>;
  rendered: Record<string, number>;
  canvases: number;
  textDraws: number;
  uploads: number;
  uploadedBytes: number;
  drawCalls: number;
  passes: number;
  gpuMs: number;
  p95: number;
  revision: number;
}

interface Viewport {
  x: number;
  y: number;
  scale: number;
}

type Phase = "moves" | "release";

interface Hooks {
  start: () => Promise<unknown>;
  stop: () => Promise<unknown>;
  phase: Phase;
}

const NO_HOOKS: Hooks = { start: async () => undefined, stop: async () => undefined, phase: "moves" };

interface Run {
  stopped: Stopped;
  task: number;
  script: number;
  release: number;
  revisionBefore: number;
  moved: boolean;
}

async function moves(page: Devtools, step: (i: number) => Promise<void>, hooks: Hooks): Promise<{ task: number; script: number }> {
  await hooks.start();
  const start = await mainThread(page);
  for (let i = 1; i <= MOVES; i++) {
    await step(i);
    await Bun.sleep(MOVE_GAP_MS);
  }
  const end = await mainThread(page);
  await hooks.stop();
  return { task: end.task - start.task, script: end.script - start.script };
}

async function dragGesture(page: Devtools, target: DragTarget, hooks: Hooks): Promise<Run> {
  const setup = await page.evaluate<{ ids: string[]; anchor: { x: number; y: number }; scale: number; before: number[][] }>(`harness.heavyTarget(${JSON.stringify(target)})`);
  const { x, y } = setup.anchor;
  await mouse(page, "mouseMoved", x, y, 0);
  await mouse(page, "mousePressed", x, y, 1);
  const revisionBefore = await page.evaluate<number>("harness.record()");
  const releasePhase = hooks.phase === "release";
  const time = await moves(page, (i) => mouse(page, "mouseMoved", x + i * DRAG_STEP.x, y + i * DRAG_STEP.y, 1), releasePhase ? NO_HOOKS : hooks);
  if (releasePhase) await hooks.start();
  const releasing = await mainThread(page);
  await mouse(page, "mouseReleased", x + MOVES * DRAG_STEP.x, y + MOVES * DRAG_STEP.y, 1);
  const stopped = await page.evaluate<Stopped>("harness.stop()");
  const released = await mainThread(page);
  if (releasePhase) await hooks.stop();
  const after = await page.evaluate<number[][]>(`harness.transformsOf(${JSON.stringify(setup.ids)})`);
  const expected = { x: (MOVES * DRAG_STEP.x) / setup.scale, y: (MOVES * DRAG_STEP.y) / setup.scale };
  const tolerance = (SNAP_THRESHOLD_SCREEN_PX + 1) / setup.scale;
  const moved = after.every(([ax, ay], i) => Math.abs(ax - setup.before[i][0] - expected.x) <= tolerance && Math.abs(ay - setup.before[i][1] - expected.y) <= tolerance);
  return { stopped, ...time, release: released.task - releasing.task, revisionBefore, moved };
}

interface Wheeled extends Run {
  rastersAfter: number;
}

async function wheelGesture(page: Devtools, zoomStep: number | null, hooks: Hooks): Promise<Wheeled> {
  const before = await page.evaluate<Viewport>("harness.heavyView()");
  const center = await page.evaluate<{ x: number; y: number }>("(() => { const r = document.querySelector('[data-studio-canvas]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
  await mouse(page, "mouseMoved", center.x, center.y, 0);
  const revisionBefore = await page.evaluate<number>("harness.record()");
  const wheel = (deltaX: number, deltaY: number, modifiers: number) => page.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: center.x, y: center.y, deltaX, deltaY, modifiers });
  const time = await moves(page, () => (zoomStep === null ? wheel(PAN_STEP.x, PAN_STEP.y, 0) : wheel(0, zoomStep, CTRL)).then(() => undefined), hooks);
  const stopped = await page.evaluate<Stopped>("harness.stop(true)");
  const after = await page.evaluate<Viewport>("harness.viewport()");
  const rastersAfter = await page.evaluate<number>("harness.rasterizedAfter()");
  const panned = Math.abs(before.x - after.x - MOVES * PAN_STEP.x) < 1 && Math.abs(before.y - after.y - MOVES * PAN_STEP.y) < 1 && rastersAfter === 0;
  const moved = zoomStep === null ? panned : after.scale > before.scale * MIN_ZOOM_GAIN;
  return { stopped, ...time, release: 0, revisionBefore, moved, rastersAfter };
}

function perform(page: Devtools, gesture: Gesture, hooks: Hooks = NO_HOOKS): Promise<Run> {
  if (gesture.kind === "drag") return dragGesture(page, gesture.target, hooks);
  return wheelGesture(page, gesture.kind === "zoom" ? ZOOM_STEP : null, hooks);
}

interface PixelDiff {
  max: number;
  differing: number;
  pixels: number;
}

async function screenshot(page: Devtools): Promise<string> {
  const { data } = (await page.send("Page.captureScreenshot", { format: "png" })) as { data: string };
  return data;
}

interface CacheCheck {
  gesture: PixelDiff;
  rested: PixelDiff;
  cachedDraws: number;
}

async function cachedMatchesLive(page: Devtools, target: DragTarget): Promise<CacheCheck> {
  await page.evaluate("harness.loadHeavy()");
  const { anchor } = await page.evaluate<{ anchor: { x: number; y: number } }>(`harness.heavyTarget(${JSON.stringify(target)})`);
  const at = (i: number) => ({ x: anchor.x + i * DRAG_STEP.x, y: anchor.y + i * DRAG_STEP.y });
  await mouse(page, "mouseMoved", anchor.x, anchor.y, 0);
  await mouse(page, "mousePressed", anchor.x, anchor.y, 1);
  for (let i = 1; i < EXACT_MOVES; i++) {
    await mouse(page, "mouseMoved", at(i).x, at(i).y, 1);
    await Bun.sleep(MOVE_GAP_MS);
  }
  let cached = "";
  let drawCalls = Infinity;
  let last = EXACT_MOVES;
  for (let attempt = 0; attempt < CAPTURE_ATTEMPTS && drawCalls > CACHED_FRAME_DRAWS; attempt++) {
    last = EXACT_MOVES + attempt;
    await page.evaluate("harness.record()");
    await mouse(page, "mouseMoved", at(last).x, at(last).y, 1);
    drawCalls = await page.evaluate<number>("harness.nextFrames().then(() => harness.drawCallsSoFar())");
    cached = await screenshot(page);
    await page.evaluate("harness.stop(true)");
  }
  await page.evaluate("harness.redrawLive()");
  const live = await screenshot(page);
  await mouse(page, "mouseReleased", at(last).x, at(last).y, 1);
  await page.evaluate("harness.settle()");
  const rested = await screenshot(page);
  await page.evaluate("harness.redrawLive()");
  const relive = await screenshot(page);
  const shots = process.env.STUDIO_PERF_SHOTS;
  if (shots) for (const [name, data] of Object.entries({ cached, live, rested, relive })) writeFileSync(join(shots, `${target}-${name}.png`), Buffer.from(data, "base64"));
  const diff = (a: string, b: string) => page.evaluate<PixelDiff>(`harness.pixelDiff(${JSON.stringify(a)}, ${JSON.stringify(b)})`);
  return { gesture: await diff(cached, live), rested: await diff(rested, relive), cachedDraws: drawCalls };
}

async function zoomSharpensOnRest(page: Devtools): Promise<{ during: number; after: number }> {
  await page.evaluate("harness.loadHeavy()");
  const run = await wheelGesture(page, DEEP_ZOOM_STEP, NO_HOOKS);
  return { during: run.stopped.canvases, after: run.rastersAfter };
}

function topRenders(rendered: Record<string, number>): string {
  return Object.entries(rendered)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_RENDERS)
    .map(([name, count]) => `${name} x${count}`)
    .join(", ");
}

function sum(record: Record<string, number>): number {
  return Object.values(record).reduce((total, value) => total + value, 0);
}

interface HeavyResult {
  scenario: string;
  taskMsPerMove: number;
  scriptMsPerMove: number;
  p95FrameMs: number;
  commitsPerMove: number;
  canvasesPerMove: number;
  textDrawsPerMove: number;
  uploadsPerMove: number;
  uploadMBPerMove: number;
  drawCallsPerMove: number;
  passesPerMove: number;
  gpuMsPerMove: number;
  gcMsPerMove: number;
  releaseMs: number;
  revisions: number;
  moved: boolean;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.floor(sorted.length / 2)];
}

function resultOf(name: string, run: Run, gcMs: number): HeavyResult {
  const { stopped } = run;
  return {
    scenario: name,
    taskMsPerMove: round(run.task / MOVES),
    scriptMsPerMove: round(run.script / MOVES),
    p95FrameMs: round(stopped.p95),
    commitsPerMove: round(sum(stopped.commits) / MOVES),
    canvasesPerMove: round(stopped.canvases / MOVES),
    textDrawsPerMove: round(stopped.textDraws / MOVES),
    uploadsPerMove: round(stopped.uploads / MOVES),
    uploadMBPerMove: round(stopped.uploadedBytes / MOVES / 1_000_000),
    drawCallsPerMove: round(stopped.drawCalls / MOVES),
    passesPerMove: round(stopped.passes / MOVES),
    gpuMsPerMove: round(stopped.gpuMs / MOVES),
    gcMsPerMove: round(gcMs / MOVES),
    releaseMs: round(run.release),
    revisions: stopped.revision - run.revisionBefore,
    moved: run.moved,
  };
}

function medianResult(results: readonly HeavyResult[]): HeavyResult {
  const numeric = (key: keyof HeavyResult) => median(results.map((r) => r[key] as number));
  const keys = Object.keys(results[0]).filter((key) => typeof results[0][key as keyof HeavyResult] === "number") as (keyof HeavyResult)[];
  return { ...results[0], ...Object.fromEntries(keys.map((key) => [key, numeric(key)])), revisions: Math.max(...results.map((r) => r.revisions)), moved: results.every((r) => r.moved) };
}

async function measure(page: Devtools, scenario: HeavyScenario): Promise<{ result: HeavyResult; renders: string }> {
  await page.evaluate("harness.loadHeavy()");
  const gcMs = await gcDuring(page, async () => void (await perform(page, scenario.gesture)));
  const runs: Run[] = [];
  for (let i = 0; i < REPEATS; i++) {
    await page.evaluate("harness.loadHeavy()");
    runs.push(await perform(page, scenario.gesture));
  }
  return { result: medianResult(runs.map((run) => resultOf(scenario.name, run, gcMs))), renders: topRenders(runs[runs.length - 1].stopped.rendered) };
}

function withinBudget(result: HeavyResult, budget: HeavyBudget): boolean {
  return (
    result.moved &&
    result.taskMsPerMove <= budget.taskMsPerMove &&
    result.p95FrameMs <= budget.p95FrameMs &&
    result.commitsPerMove <= budget.commitsPerMove &&
    result.canvasesPerMove <= budget.canvasesPerMove &&
    result.uploadsPerMove <= budget.uploadsPerMove &&
    result.drawCallsPerMove <= budget.drawCallsPerMove &&
    result.passesPerMove <= budget.passesPerMove &&
    result.releaseMs <= budget.releaseMs &&
    result.revisions === budget.revisions
  );
}

function describe(budget: HeavyBudget): string {
  return `per move: ${budget.taskMsPerMove} ms main thread, ${budget.commitsPerMove} commits, ${budget.canvasesPerMove} rasters, ${budget.uploadsPerMove} uploads, ${budget.drawCallsPerMove} draw calls, ${budget.passesPerMove} GPU passes; p95 frame ${budget.p95FrameMs} ms; release ${budget.releaseMs} ms; ${budget.revisions} revisions`;
}

export async function runHeavy(page: Devtools): Promise<boolean> {
  const measured = [];
  for (const scenario of HEAVY_SCENARIOS) measured.push(await measure(page, scenario));
  console.table(measured.map((m) => m.result));
  for (const { result, renders } of measured) if (renders) console.log(`${result.scenario} renders: ${renders}`);
  const verdicts = measured.map(({ result }, i) => [result.scenario, HEAVY_SCENARIOS[i].budget, withinBudget(result, HEAVY_SCENARIOS[i].budget)] as const);
  for (const [name, budget, ok] of verdicts) console.log(`${ok ? "PASS" : "FAIL"}  ${name} (budget: ${describe(budget)})`);
  const zoom = await zoomSharpensOnRest(page);
  const sharp = zoom.during === 0 && zoom.after > 0;
  console.log(`${sharp ? "PASS" : "FAIL"}  heavy: zoom keeps textures while moving and sharpens once at rest (${zoom.during} rasters while zooming, ${zoom.after} after)`);
  const exact: boolean[] = [];
  for (const target of DRAG_TARGETS) {
    const check = await cachedMatchesLive(page, target);
    const cachedOk = check.cachedDraws <= CACHED_FRAME_DRAWS && check.gesture.max <= CACHE_TOLERANCE;
    const restedOk = check.rested.max === 0;
    exact.push(cachedOk && restedOk);
    console.log(`${cachedOk ? "PASS" : "FAIL"}  heavy: drag ${target} draws from the gesture cache (${check.cachedDraws} draw calls) within ${CACHE_TOLERANCE} levels of a live frame away from artboard edges (max ${check.gesture.max}, ${check.gesture.differing} of ${check.gesture.pixels} pixels differ)`);
    console.log(`${restedOk ? "PASS" : "FAIL"}  heavy: drag ${target} rests on a live frame after release (max ${check.rested.max}, ${check.rested.differing} pixels differ)`);
  }
  return verdicts.every(([, , ok]) => ok) && sharp && exact.every(Boolean);
}

export async function profileHeavy(page: Devtools, index: number): Promise<void> {
  const scenario = HEAVY_SCENARIOS[index] ?? HEAVY_SCENARIOS[0];
  await page.evaluate("harness.loadHeavy()");
  let run: Run | null = null;
  const profile = await profileDuring(page, async (start, stop) => {
    run = await perform(page, scenario.gesture, { start, stop, phase: process.env.STUDIO_PERF_RELEASE === "1" ? "release" : "moves" });
  });
  printProfile(scenario.name, profile);
  const done = run as Run | null;
  if (done) console.log(`commits: ${JSON.stringify(done.stopped.commits)}; renders: ${topRenders(done.stopped.rendered)}`);
  await page.evaluate("harness.loadHeavy()");
  const events = await traceDuring(page, TIMELINE_CATEGORIES, async () => void (await perform(page, scenario.gesture)));
  printTimeline(scenario.name, events);
  const out = process.env.STUDIO_PERF_TRACE;
  if (out) writeFileSync(out, JSON.stringify({ traceEvents: events }));
}
