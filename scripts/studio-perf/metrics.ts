import type { Devtools } from "./harness";

export interface MainThread {
  task: number;
  script: number;
}

export async function mainThread(page: Devtools): Promise<MainThread> {
  const { metrics } = (await page.send("Performance.getMetrics")) as { metrics: { name: string; value: number }[] };
  const value = (name: string) => (metrics.find((m) => m.name === name)?.value ?? 0) * 1000;
  return { task: value("TaskDuration"), script: value("ScriptDuration") };
}

export function round(value: number): number {
  return Math.round(value * 10) / 10;
}

interface ProfileNode {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
  children?: number[];
}

export interface CpuProfile {
  nodes: ProfileNode[];
  samples: number[];
  timeDeltas: number[];
}

const TOP_FUNCTIONS = 30;

export function printProfile(label: string, profile: CpuProfile): void {
  const self = new Map<number, number>();
  profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
  const byFunction = new Map<string, number>();
  for (const node of profile.nodes) {
    const frame = node.callFrame;
    const name = `${frame.functionName || "(anonymous)"} ${frame.url.split("/").pop()}:${frame.lineNumber + 1}`;
    byFunction.set(name, (byFunction.get(name) ?? 0) + (self.get(node.id) ?? 0) / 1000);
  }
  console.log(`CPU profile, ${label}, self time in ms:`);
  for (const [name, ms] of [...byFunction.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_FUNCTIONS)) console.log(`${ms.toFixed(1).padStart(8)}  ${name}`);
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const nameOf = (node: ProfileNode) => `${node.callFrame.functionName || "(anonymous)"} ${node.callFrame.url.split("/").pop()}:${node.callFrame.lineNumber + 1}`;
  const total = new Map<string, number>();
  const visit = (node: ProfileNode, onPath: Set<string>): number => {
    const own = (self.get(node.id) ?? 0) / 1000;
    const name = nameOf(node);
    const inner = new Set(onPath).add(name);
    const sum = own + (node.children ?? []).reduce((acc, id) => acc + visit(nodes.get(id)!, inner), 0);
    if (!onPath.has(name)) total.set(name, (total.get(name) ?? 0) + sum);
    return sum;
  };
  visit(profile.nodes[0], new Set());
  console.log(`CPU profile, ${label}, total time in ms:`);
  for (const [name, ms] of [...total.entries()].filter(([name]) => !name.startsWith("(")).sort((a, b) => b[1] - a[1]).slice(0, TOP_FUNCTIONS)) console.log(`${ms.toFixed(1).padStart(8)}  ${name}`);
}

export async function profileDuring(page: Devtools, run: (start: () => Promise<unknown>, stop: () => Promise<unknown>) => Promise<void>): Promise<CpuProfile> {
  await page.send("Profiler.enable");
  await page.send("Profiler.setSamplingInterval", { interval: 200 });
  let stopped: Promise<Record<string, unknown>> = Promise.resolve({});
  await run(
    () => page.send("Profiler.start"),
    async () => (stopped = page.send("Profiler.stop")),
  );
  return ((await stopped) as { profile: CpuProfile }).profile;
}

export interface TraceEvent {
  name: string;
  cat: string;
  ph: string;
  ts: number;
  dur?: number;
  pid: number;
  tid: number;
  args?: { name?: string };
}

const GC_EVENTS = new Set(["MinorGC", "MajorGC"]);
const GC_CATEGORIES = ["devtools.timeline", "disabled-by-default-v8.gc"];
export const TIMELINE_CATEGORIES = ["devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.frame", "v8", "v8.execute", "disabled-by-default-v8.gc", "disabled-by-default-v8.cpu_profiler", "blink", "cc", "gpu", "viz", "toplevel"];

export async function traceDuring(page: Devtools, categories: readonly string[], run: () => Promise<void>): Promise<TraceEvent[]> {
  const events: TraceEvent[] = [];
  const offData = page.on("Tracing.dataCollected", (params) => events.push(...(params.value as TraceEvent[])));
  const complete = new Promise<void>((resolve) => {
    const offComplete = page.on("Tracing.tracingComplete", () => {
      offComplete();
      resolve();
    });
  });
  await page.send("Tracing.start", { traceConfig: { includedCategories: categories }, transferMode: "ReportEvents" });
  await run();
  await page.send("Tracing.end");
  await complete;
  offData();
  return events;
}

function threadsNamed(events: readonly TraceEvent[], name: string): Set<string> {
  return new Set(events.filter((event) => event.name === "thread_name" && event.args?.name === name).map((event) => `${event.pid}:${event.tid}`));
}

export async function gcDuring(page: Devtools, run: () => Promise<void>): Promise<number> {
  const events = await traceDuring(page, GC_CATEGORIES, run);
  const mains = threadsNamed(events, "CrRendererMain");
  return events.filter((event) => event.ph === "X" && GC_EVENTS.has(event.name) && mains.has(`${event.pid}:${event.tid}`)).reduce((sum, event) => sum + (event.dur ?? 0), 0) / 1000;
}

const TOP_EVENTS = 25;

export function printTimeline(label: string, events: readonly TraceEvent[]): void {
  const names = new Map<string, string>();
  for (const event of events) if (event.name === "thread_name" && event.args?.name) names.set(`${event.pid}:${event.tid}`, event.args.name);
  const complete = events.filter((event) => event.ph === "X" && (event.dur ?? 0) > 0).sort((a, b) => a.ts - b.ts || (b.dur ?? 0) - (a.dur ?? 0));
  const self = new Map<string, number>();
  const stacks = new Map<string, TraceEvent[]>();
  for (const event of complete) {
    const thread = `${event.pid}:${event.tid}`;
    const stack = stacks.get(thread) ?? [];
    while (stack.length > 0 && stack[stack.length - 1].ts + (stack[stack.length - 1].dur ?? 0) <= event.ts) stack.pop();
    const parent = stack[stack.length - 1];
    const key = (e: TraceEvent) => `${names.get(thread) ?? thread} | ${e.name}`;
    self.set(key(event), (self.get(key(event)) ?? 0) + (event.dur ?? 0));
    if (parent) self.set(key(parent), (self.get(key(parent)) ?? 0) - (event.dur ?? 0));
    stack.push(event);
    stacks.set(thread, stack);
  }
  console.log(`Trace, ${label}, self time in ms by thread and event:`);
  for (const [name, us] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_EVENTS)) console.log(`${(us / 1000).toFixed(1).padStart(8)}  ${name}`);
}
