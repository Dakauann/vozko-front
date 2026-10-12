interface Fiber {
  tag: number;
  flags: number;
  type: unknown;
  child: Fiber | null;
  sibling: Fiber | null;
  alternate: Fiber | null;
}

interface FiberRoot {
  current: Fiber;
}

const PERFORMED_WORK = 1;
const COMPONENT_TAGS = new Set([0, 1, 11, 14, 15]);

export interface ProbeCounts {
  commits: Record<string, number>;
  rendered: Record<string, number>;
  canvases: number;
  textDraws: number;
  uploads: number;
  uploadedBytes: number;
  drawCalls: number;
  passes: number;
  gpuMs: number;
  stacks: [string, number][];
}

const counts: Omit<ProbeCounts, "stacks"> = { commits: {}, rendered: {}, canvases: 0, textDraws: 0, uploads: 0, uploadedBytes: 0, drawCalls: 0, passes: 0, gpuMs: 0 };
const stacks = new Map<string, number>();
const STACK_DEPTH = 5;
const TOP_STACKS = 3;
const renderers = new Map<number, string>();
let recording = false;
let lastCanvasAt = 0;

function nameOf(type: unknown): string {
  if (typeof type === "function") return (type as { displayName?: string; name?: string }).displayName || type.name || "anonymous";
  if (type && typeof type === "object") {
    const wrapped = type as { displayName?: string; type?: unknown; render?: unknown };
    return wrapped.displayName || nameOf(wrapped.type ?? wrapped.render);
  }
  return "anonymous";
}

function rendered(fiber: Fiber): boolean {
  return COMPONENT_TAGS.has(fiber.tag) && (fiber.flags & PERFORMED_WORK) === PERFORMED_WORK;
}

function walk(fiber: Fiber, renderer: string): void {
  if (rendered(fiber)) {
    const key = `${renderer}:${nameOf(fiber.type)}`;
    counts.rendered[key] = (counts.rendered[key] ?? 0) + 1;
  }
  const previous = fiber.alternate;
  if (previous && fiber.child === previous.child) return;
  for (let child = fiber.child; child; child = child.sibling) walk(child, renderer);
}

let nextRenderer = 1;
Object.assign(window, {
  __REACT_DEVTOOLS_GLOBAL_HOOK__: {
    supportsFiber: true,
    isDisabled: false,
    renderers: new Map(),
    inject(internals: { rendererPackageName?: string }) {
      const id = nextRenderer++;
      renderers.set(id, internals.rendererPackageName ?? `renderer-${id}`);
      return id;
    },
    onCommitFiberRoot(id: number, root: FiberRoot) {
      if (!recording) return;
      const renderer = renderers.get(id) ?? "unknown";
      counts.commits[renderer] = (counts.commits[renderer] ?? 0) + 1;
      for (let child = root.current.child; child; child = child.sibling) walk(child, renderer);
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
  },
});

const createElement = document.createElement.bind(document);
document.createElement = ((tag: string, options?: ElementCreationOptions) => {
  if (tag === "canvas") {
    lastCanvasAt = performance.now();
    if (recording) {
      counts.canvases += 1;
      const where = (new Error().stack ?? "").split(String.fromCharCode(10)).slice(2, 2 + STACK_DEPTH).join(" < ");
      stacks.set(where, (stacks.get(where) ?? 0) + 1);
    }
  }
  return createElement(tag, options);
}) as typeof document.createElement;

for (const method of ["fillText", "strokeText"] as const) {
  const original = CanvasRenderingContext2D.prototype[method];
  CanvasRenderingContext2D.prototype[method] = function (this: CanvasRenderingContext2D, ...args: Parameters<typeof original>) {
    if (recording) counts.textDraws += 1;
    return original.apply(this, args);
  } as typeof original;
}

function sizeOf(args: unknown[]): number {
  const source = args.find((arg) => arg !== null && typeof arg === "object" && "width" in (arg as object) && "height" in (arg as object)) as { width: number; height: number } | undefined;
  if (source) return source.width * source.height * 4;
  const numbers = args.filter((arg): arg is number => typeof arg === "number");
  return numbers.length >= 5 ? numbers[3] * numbers[4] * 4 : 0;
}

for (const context of [WebGLRenderingContext, WebGL2RenderingContext]) {
  for (const method of ["texImage2D", "texSubImage2D"] as const) {
    const original = context.prototype[method] as (...args: unknown[]) => void;
    (context.prototype as unknown as Record<string, unknown>)[method] = function (this: WebGLRenderingContext, ...args: unknown[]) {
      if (recording) {
        counts.uploads += 1;
        counts.uploadedBytes += sizeOf(args);
      }
      return original.apply(this, args);
    };
  }
}

const DRAWS = ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"] as const;

for (const context of [WebGLRenderingContext, WebGL2RenderingContext]) {
  const prototype = context.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
  for (const method of DRAWS) {
    const original = prototype[method];
    if (!original) continue;
    prototype[method] = function (this: WebGLRenderingContext, ...args: unknown[]) {
      if (recording) counts.drawCalls += 1;
      return original.apply(this, args);
    };
  }
  const bind = prototype.bindFramebuffer;
  prototype.bindFramebuffer = function (this: WebGLRenderingContext, ...args: unknown[]) {
    if (recording) counts.passes += 1;
    return bind.apply(this, args);
  };
}

interface TimerQuery {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

const contexts: WebGL2RenderingContext[] = [];
const getContext = HTMLCanvasElement.prototype.getContext as (this: HTMLCanvasElement, kind: string, options?: unknown) => RenderingContext | null;
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, options?: unknown) {
  const context = getContext.call(this, kind, options);
  if (kind === "webgl2" && context && !contexts.includes(context as WebGL2RenderingContext)) contexts.push(context as WebGL2RenderingContext);
  return context;
} as typeof HTMLCanvasElement.prototype.getContext;

const pending: { gl: WebGL2RenderingContext; ext: TimerQuery; query: WebGLQuery }[] = [];

function collect(): void {
  while (pending.length > 0) {
    const { gl, ext, query } = pending[0];
    if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) return;
    pending.shift();
    if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) {
      counts.gpuMs += Number(gl.getQueryParameter(query, gl.QUERY_RESULT)) / 1_000_000;
    }
    gl.deleteQuery(query);
  }
}

const requestFrame = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = (callback: FrameRequestCallback) =>
  requestFrame((time) => {
    const gl = recording ? contexts.find((context) => context.canvas instanceof HTMLCanvasElement && context.canvas.isConnected) : undefined;
    const ext = gl?.getExtension("EXT_disjoint_timer_query_webgl2") as TimerQuery | null | undefined;
    const query = gl && ext ? gl.createQuery() : null;
    if (gl && ext && query) gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    try {
      callback(time);
    } finally {
      if (gl && ext && query) {
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        pending.push({ gl, ext, query });
      }
      collect();
    }
  });

export function startProbes(): void {
  counts.commits = {};
  counts.rendered = {};
  counts.canvases = 0;
  counts.textDraws = 0;
  counts.uploads = 0;
  counts.uploadedBytes = 0;
  counts.drawCalls = 0;
  counts.passes = 0;
  counts.gpuMs = 0;
  stacks.clear();
  recording = true;
}

const RESULT_TRIES = 30;
const RESULT_WAIT_MS = 16;

export async function stopProbes(): Promise<ProbeCounts> {
  recording = false;
  for (let tries = 0; pending.length > 0 && tries < RESULT_TRIES; tries++) {
    await new Promise((resolve) => setTimeout(resolve, RESULT_WAIT_MS));
    collect();
  }
  return { ...counts, commits: { ...counts.commits }, rendered: { ...counts.rendered }, stacks: [...stacks.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_STACKS) };
}

export function lastCanvasCreatedAt(): number {
  return lastCanvasAt;
}

export function drawCallsSoFar(): number {
  return counts.drawCalls;
}
