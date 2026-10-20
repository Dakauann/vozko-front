import type { Workflow } from "@/lib/workflows/types";

import { GPU_FLAGS, keepBundle, mouse, navigate, withHarness, type Devtools } from "../studio-perf/harness";
import { mainThread, printProfile, printTimeline, profileDuring, round, TIMELINE_CATEGORIES, traceDuring } from "../studio-perf/metrics";
import { fixtureWorkflow } from "./fixture";
import { READY, workflowsHarnessOptions } from "./harness-options";
import { imageFixtureWorkflow } from "./image-fixture";

const MOVES = 60;
const PAN_PX = 6;
const DRAG_PX = 4;
const MOVE_GAP_MS = 8;
const WHEEL_STEPS = 20;
const WHEEL_DELTA = 120;
const IDLE_MS = 2000;
const READABLE_ZOOM = 1;
const CENTRAL_BAND = [0.3, 0.6];

interface Point {
  x: number;
  y: number;
}

interface Stopped {
  frames: number;
  p50: number;
  p95: number;
  max: number;
  slow: number;
  rendered: Record<string, number>;
}

interface Budget {
  p50FrameMs?: number;
  p95FrameMs: number;
  taskMsPerMove: number;
  edgeRendersPerMove?: number;
}

const BUDGETS: Record<string, Budget> = {
  "idle at fit": { p95FrameMs: 20, taskMsPerMove: 4 },
  "pan at fit": { p95FrameMs: 36, taskMsPerMove: 16 },
  "zoom wheel at fit": { p50FrameMs: 24, p95FrameMs: 125, taskMsPerMove: 60 },
  "drag node at fit": { p95FrameMs: 36, taskMsPerMove: 30, edgeRendersPerMove: 25 },
  "pan at zoom 1": { p95FrameMs: 36, taskMsPerMove: 16 },
  "drag node at zoom 1": { p95FrameMs: 36, taskMsPerMove: 20, edgeRendersPerMove: 20 },
  "idle at zoom 1, node selected": { p95FrameMs: 20, taskMsPerMove: 4 },
};

const RENDER_KEYS = ["WorkflowEditor", "SmartBezierEdge", "NodeConfigPanel", "WorkflowNodeComponent"];

function busiestCentralNode(workflow: Workflow): string {
  const right = Math.max(...workflow.graph.nodes.map((node) => node.position.x));
  const central = new Set(workflow.graph.nodes.filter((node) => node.position.x > right * CENTRAL_BAND[0] && node.position.x < right * CENTRAL_BAND[1]).map((node) => node.id));
  const degree = new Map<string, number>();
  for (const edge of workflow.graph.edges) {
    for (const id of [edge.source, edge.target]) if (central.has(id)) degree.set(id, (degree.get(id) ?? 0) + 1);
  }
  return [...degree.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

const TOP_RENDERS = 30;

function printRenders(scenario: string, rendered: Record<string, number>) {
  const totals = new Map<string, number>();
  for (const [key, count] of Object.entries(rendered)) {
    const name = key.split(":").pop()!;
    totals.set(name, (totals.get(name) ?? 0) + count);
  }
  console.log(`Component renders, ${scenario}:`);
  for (const [name, count] of [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_RENDERS)) console.log(`${String(count).padStart(8)}  ${name}`);
}

function renders(rendered: Record<string, number>) {
  const total = (name: string) => Object.entries(rendered).filter(([key]) => key.split(":").pop()!.startsWith(name)).reduce((sum, [, count]) => sum + count, 0);
  return Object.fromEntries(RENDER_KEYS.map((name) => [name, total(name)]));
}

async function measure(page: Devtools, name: string, moves: number, act: () => Promise<void>) {
  await page.evaluate("harness.settle()");
  const readsBefore = await mediaShown(page);
  await page.evaluate("harness.record()");
  const start = await mainThread(page);
  if (process.env.WORKFLOWS_PERF_PROFILE === name) {
    const profile = await profileDuring(page, async (begin, finish) => {
      await begin();
      await act();
      await finish();
    });
    printProfile(name, profile);
  } else if (process.env.WORKFLOWS_PERF_TRACE === name) {
    printTimeline(name, await traceDuring(page, TIMELINE_CATEGORIES, act));
  } else {
    await act();
  }
  const end = await mainThread(page);
  const readsAfter = await mediaShown(page);
  const stopped = await page.evaluate<Stopped>("harness.stop()");
  if (process.env.WORKFLOWS_PERF_RENDERS === name) printRenders(name, stopped.rendered);
  return {
    scenario: name,
    taskMsPerMove: round((end.task - start.task) / moves),
    scriptMsPerMove: round((end.script - start.script) / moves),
    p50FrameMs: round(stopped.p50),
    p95FrameMs: round(stopped.p95),
    maxFrameMs: round(stopped.max),
    slowFrames: stopped.slow,
    mediaReads: readsAfter.reads - readsBefore.reads,
    fileRequests: readsAfter.requests - readsBefore.requests,
    ...renders(stopped.rendered),
  };
}

async function dragFrom(page: Devtools, from: Point, step: Point) {
  await mouse(page, "mouseMoved", from.x, from.y, 0);
  await mouse(page, "mousePressed", from.x, from.y, 1);
  for (let i = 1; i <= MOVES; i++) {
    await mouse(page, "mouseMoved", from.x + i * step.x, from.y + i * step.y, 1);
    await Bun.sleep(MOVE_GAP_MS);
  }
  await mouse(page, "mouseReleased", from.x + MOVES * step.x, from.y + MOVES * step.y, 1);
}

async function wheel(page: Devtools, at: Point, deltaY: number) {
  await page.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: at.x, y: at.y, deltaX: 0, deltaY });
  await Bun.sleep(MOVE_GAP_MS * 2);
}

async function pan(page: Devtools, name: string) {
  const spot = await page.evaluate<Point | null>("harness.paneSpot()");
  if (!spot) throw new Error(`${name}: no empty pane spot`);
  return measure(page, name, MOVES, () => dragFrom(page, spot, { x: -PAN_PX, y: -PAN_PX / 2 }));
}

async function dragNode(page: Devtools, name: string, id: string) {
  const grip = await page.evaluate<Point | null>(`harness.grip(${JSON.stringify(id)})`);
  if (!grip) throw new Error(`${name}: node ${id} is not on screen`);
  const before = await page.evaluate<Point>(`harness.position(${JSON.stringify(id)})`);
  const result = await measure(page, name, MOVES, () => dragFrom(page, grip, { x: DRAG_PX, y: DRAG_PX / 2 }));
  const after = await page.evaluate<Point>(`harness.position(${JSON.stringify(id)})`);
  await page.evaluate(`harness.place(${JSON.stringify(id)}, ${JSON.stringify(before)})`);
  const restored = await page.evaluate<Point>(`harness.position(${JSON.stringify(id)})`);
  return { ...result, moved: (after.x !== before.x || after.y !== before.y) && restored.x === before.x && restored.y === before.y };
}

interface MediaShown {
  reads: number;
  requests: number;
  images: number;
  decoded: number;
  unsized: number;
  videos: number;
  playing: number;
}

interface Suite {
  label: string;
  path: string;
  workflow: Workflow;
  imagesAtFit?: number;
}

const IMAGE_MEDIA_AT_FIT = 16;

const SUITES: Suite[] = [
  { label: "", path: "/", workflow: fixtureWorkflow() },
  { label: "images: ", path: "/?fixture=images", workflow: imageFixtureWorkflow(), imagesAtFit: IMAGE_MEDIA_AT_FIT },
];

const IMAGE_SETTLE_MS = 1500;

async function mediaShown(page: Devtools): Promise<MediaShown> {
  return page.evaluate<MediaShown>("harness.media()");
}

async function runSuite(page: Devtools, suite: Suite) {
  const target = busiestCentralNode(suite.workflow);
  const fit = await page.evaluate<{ zoom: number }>("harness.fit()");
  await Bun.sleep(IMAGE_SETTLE_MS);
  const atFit = await mediaShown(page);
  console.log(`${suite.label}fixture: ${JSON.stringify(await page.evaluate("harness.counts()"))}, fit zoom ${round(fit.zoom * 100) / 100}, dragged node ${target}, media at fit ${JSON.stringify(atFit)}`);
  const results: Record<string, unknown>[] = [];
  const named = (name: string) => `${suite.label}${name}`;
  results.push(await measure(page, named("idle at fit"), IDLE_MS / 16, () => Bun.sleep(IDLE_MS)));
  results.push(await pan(page, named("pan at fit")));
  await page.evaluate("harness.fit()");
  const center = await page.evaluate<Point>("harness.center()");
  results.push(
    await measure(page, named("zoom wheel at fit"), WHEEL_STEPS * 2, async () => {
      for (let i = 0; i < WHEEL_STEPS; i++) await wheel(page, center, -WHEEL_DELTA);
      for (let i = 0; i < WHEEL_STEPS; i++) await wheel(page, center, WHEEL_DELTA);
    }),
  );
  await page.evaluate("harness.fit()");
  results.push(await dragNode(page, named("drag node at fit"), target));
  await page.evaluate(`harness.focus(${JSON.stringify(target)}, ${READABLE_ZOOM})`);
  results.push(await pan(page, named("pan at zoom 1")));
  await page.evaluate(`harness.focus(${JSON.stringify(target)}, ${READABLE_ZOOM})`);
  results.push(await dragNode(page, named("drag node at zoom 1"), target));
  results.push(await measure(page, named("idle at zoom 1, node selected"), IDLE_MS / 16, () => Bun.sleep(IDLE_MS)));
  console.log(`${suite.label}after: ${JSON.stringify(await page.evaluate("harness.counts()"))}, media ${JSON.stringify(await mediaShown(page))}`);
  console.table(results);
  const verdicts = results.map((result) => {
    const name = String(result.scenario);
    const budget = BUDGETS[name.slice(suite.label.length)];
    const edgeRenders = Number(result.SmartBezierEdge) / MOVES;
    const ok = Number(result.p50FrameMs) <= (budget.p50FrameMs ?? Infinity) && Number(result.p95FrameMs) <= budget.p95FrameMs && Number(result.taskMsPerMove) <= budget.taskMsPerMove && edgeRenders <= (budget.edgeRendersPerMove ?? Infinity) && result.moved !== false;
    const edgeBudget = budget.edgeRendersPerMove ? `, ${budget.edgeRendersPerMove} edge renders per move` : "";
    const medianBudget = budget.p50FrameMs ? `p50 frame ${budget.p50FrameMs} ms, ` : "";
    console.log(`${ok ? "PASS" : "FAIL"}  ${name} (budget: ${medianBudget}p95 frame ${budget.p95FrameMs} ms, ${budget.taskMsPerMove} ms of main thread per move${edgeBudget})`);
    return ok;
  });
  if (suite.imagesAtFit !== undefined) {
    const shown = atFit.decoded >= suite.imagesAtFit && atFit.playing === 0 && atFit.unsized === 0;
    console.log(`${shown ? "PASS" : "FAIL"}  ${suite.label}media at fit (budget: at least ${suite.imagesAtFit} decoded images, every image sized, no playing video)`);
    verdicts.push(shown);
  }
  return verdicts.every(Boolean);
}

const passed = await withHarness(
  async (harness) => {
    const { page } = harness;
    keepBundle(harness, process.env.WORKFLOWS_PERF_BUNDLE);
    const verdicts: boolean[] = [];
    for (const suite of SUITES) {
      if (suite.path !== "/") await navigate(page, suite.path, READY);
      verdicts.push(await runSuite(page, suite));
    }
    if (GPU_FLAGS.includes("--use-angle=swiftshader")) console.log("Software GPU: frame times measure SwiftShader, not the editor.");
    return verdicts.every(Boolean);
  },
  workflowsHarnessOptions(),
);
process.exit(passed ? 0 : 1);
