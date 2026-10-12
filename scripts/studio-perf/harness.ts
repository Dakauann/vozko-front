import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const HERE = import.meta.dir;
export const ROOT = resolve(HERE, "../..");
const PAGE_PORT = Number(process.env.STUDIO_HARNESS_PORT ?? 9361);
const DEBUG_PORT = PAGE_PORT + 1;
const READY_TIMEOUT_MS = 60_000;

export const GPU_FLAGS = process.env.STUDIO_PERF_GPU === "software" ? ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] : ["--use-angle=d3d11", "--enable-gpu-rasterization", "--ignore-gpu-blocklist"];
export const UNCAPPED_FLAGS = ["--disable-gpu-vsync", "--disable-frame-rate-limit"];
const FRAME_FLAGS = process.env.STUDIO_PERF_UNCAPPED === "1" ? UNCAPPED_FLAGS : [];

const STUBS: Record<string, string> = {
  "next-intl": join(HERE, "stubs/next-intl.ts"),
  "next/dynamic": join(HERE, "stubs/next-dynamic.ts"),
  "next/image": join(HERE, "stubs/next-image.ts"),
  "next/link": join(HERE, "stubs/next-misc.ts"),
  "next/navigation": join(HERE, "stubs/next-misc.ts"),
};

function actionStub(path: string): string {
  const source = readFileSync(path, "utf8");
  const names = [...source.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(\w+)/g)].map((m) => m[1]);
  return names.map((name) => `export async function ${name}() { return ${name.startsWith("get") ? "null" : '{ error: "harness", code: "harness" }'}; }`).join("\n");
}

export interface HarnessOptions {
  entry?: string;
  path?: string;
  ready?: string;
  overrides?: Record<string, string>;
  modules?: Record<string, string>;
  worker?: boolean;
  fixtures?: (dir: string) => void;
}

async function bundle(dir: string, options: HarnessOptions): Promise<void> {
  const overrides = options.overrides ?? {};
  const swapped = new Map(Object.entries(options.modules ?? {}).map(([specifier, path]) => [join(ROOT, "src", specifier.replace(/^@\//, "")), path]));
  if (options.worker) {
    const worker = await Bun.build({ entrypoints: [join(ROOT, "src/components/studio/media/media.worker.ts")], outdir: dir, format: "esm", target: "browser", define: { "process.env.NODE_ENV": '"production"' } });
    if (!worker.success) throw new Error(worker.logs.join("\n"));
  }
  const built = await Bun.build({
    entrypoints: [options.entry ?? join(HERE, "page.ts")],
    outdir: dir,
    naming: { entry: "page.[ext]" },
    format: "esm",
    target: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
    external: ["pixi.js", "pixi.js/advanced-blend-modes"],
    plugins: [
      {
        name: "harness-stubs",
        setup: (build) => {
          if (swapped.size > 0) {
            build.onResolve({ filter: /^(@\/|\.)/ }, (args) => {
              const target = args.path.startsWith("@/") ? join(ROOT, "src", args.path.slice(2)) : resolve(dirname(args.importer), args.path);
              const path = swapped.get(target);
              return path && args.importer !== path ? { path } : undefined;
            });
          }
          build.onResolve({ filter: /^(next-intl|next\/dynamic|next\/image|next\/link|next\/navigation)$/ }, (args) => ({ path: STUBS[args.path] }));
          build.onResolve({ filter: /^@\/app\/actions\/(?!action-result$)/ }, (args) => (overrides[args.path] ? { path: overrides[args.path] } : { path: join(ROOT, "src", args.path.slice(2)) + ".ts", namespace: "action-stub" }));
          build.onLoad({ filter: /.*/, namespace: "action-stub" }, (args) => ({ contents: actionStub(args.path), loader: "ts" }));
        },
      },
    ],
  });
  if (!built.success) throw new Error(built.logs.join("\n"));
}

function styles(dir: string): void {
  const run = spawnSync(join(ROOT, "node_modules/.bin/tailwindcss.exe"), ["-i", join(ROOT, "src/app/globals.css"), "-o", join(dir, "app.css")], { cwd: ROOT });
  if (run.status !== 0) throw new Error(`tailwind failed: ${run.stderr.toString()}`);
}

const PAGE = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><link rel="stylesheet" href="/app.css"><link rel="stylesheet" href="/page.css"><script>window.process = { env: {} };</script>
<script type="importmap">{"imports":{"pixi.js":"/pixi.mjs","pixi.js/advanced-blend-modes":"/blends.mjs"}}</script></head>
<body><div id="root"></div><script type="module" src="/page.js"></script></body></html>`;

const BLENDS = `import * as PIXI from "/pixi.mjs";
PIXI.extensions.add(...Object.entries(PIXI).filter(([name, value]) => name.endsWith("Blend") && typeof value === "function" && value.extension).map(([, value]) => value));`;

function serve(dir: string) {
  const script = (body: BodyInit) => new Response(body, { headers: { "content-type": "text/javascript" } });
  return Bun.serve({
    port: PAGE_PORT,
    fetch: (request) => {
      const path = new URL(request.url).pathname;
      if (path === "/") return new Response(PAGE, { headers: { "content-type": "text/html" } });
      if (path === "/pixi.mjs") return script(Bun.file(join(ROOT, "node_modules/pixi.js/dist/pixi.mjs")));
      if (path === "/blends.mjs") return script(BLENDS);
      if (path.endsWith(".worker.ts")) return script(Bun.file(join(dir, "media.worker.js")));
      if (path.startsWith("/fixtures/")) return new Response(Bun.file(join(dir, "fixtures", decodeURIComponent(path.slice("/fixtures/".length)))));
      const file = Bun.file(join(dir, path));
      if (file.size > 0) return new Response(file);
      const shared = Bun.file(join(ROOT, "public", decodeURIComponent(path)));
      return shared.size > 0 ? new Response(shared) : new Response("missing", { status: 404 });
    },
  });
}

function browserPath(): string {
  const configured = process.env.STUDIO_PERF_BROWSER;
  if (configured) return configured;
  const candidates = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/chromium", "/usr/bin/google-chrome"];
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error("No Chromium based browser found. Set STUDIO_PERF_BROWSER.");
  return found;
}

export interface Devtools {
  send: (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  evaluate: <T>(expression: string) => Promise<T>;
  on: (method: string, listener: (params: Record<string, unknown>) => void) => () => void;
  errors: string[];
  quiet: boolean;
  close: () => void;
}

async function devtools(path = "/"): Promise<Devtools> {
  let target: { webSocketDebuggerUrl: string } | null = null;
  for (let attempt = 0; attempt < 50 && !target; attempt++) {
    await Bun.sleep(200);
    target = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?http://127.0.0.1:${PAGE_PORT}${path}`, { method: "PUT" })
      .then((response) => response.json())
      .catch(() => null);
  }
  if (!target) throw new Error("The browser did not open its debugging port.");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ready) => socket.addEventListener("open", ready));
  const waiting = new Map<number, (message: { result?: Record<string, unknown>; error?: { message: string } }) => void>();
  let id = 0;
  const errors: string[] = [];
  const listeners = new Map<string, Set<(params: Record<string, unknown>) => void>>();
  const on = (method: string, listener: (params: Record<string, unknown>) => void) => {
    const set = listeners.get(method) ?? new Set();
    set.add(listener);
    listeners.set(method, set);
    return () => set.delete(listener);
  };
  const report = (label: string, text: string) => {
    errors.push(text);
    if (!page.quiet) console.error(label, text);
  };
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method === "Page.javascriptDialogOpening") void send("Page.handleJavaScriptDialog", { accept: true }).catch(() => undefined);
    if (message.method === "Runtime.exceptionThrown") report("page error:", String(message.params.exceptionDetails?.exception?.description ?? message.params.exceptionDetails?.text));
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") report("page console:", message.params.args.map((a: { value?: unknown; description?: string }) => a.value ?? a.description).join(" "));
    if (message.method) for (const listener of listeners.get(message.method) ?? []) listener(message.params ?? {});
    waiting.get(message.id)?.(message);
    waiting.delete(message.id);
  });
  const send = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<Record<string, unknown>>((answer, fail) => {
      id += 1;
      waiting.set(id, (message) => (message.error ? fail(new Error(`${method}: ${message.error.message}`)) : answer(message.result ?? {})));
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async <T>(expression: string): Promise<T> => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    const thrown = result.exceptionDetails as { exception?: { description?: string } } | undefined;
    if (thrown) throw new Error(thrown.exception?.description ?? "evaluation failed");
    return (result.result as { value: T }).value;
  };
  await send("Runtime.enable");
  await send("Performance.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const page: Devtools = { send, evaluate, on, errors, quiet: false, close: () => socket.close() };
  return page;
}

export async function mouse(page: Devtools, type: string, x: number, y: number, buttons: number, modifiers = 0): Promise<void> {
  await page.send("Input.dispatchMouseEvent", { type, x, y, modifiers, button: type === "mouseMoved" && buttons === 0 ? "none" : "left", buttons, clickCount: type === "mouseMoved" ? 0 : 1 });
}

export async function dragBy(page: Devtools, from: { x: number; y: number }, to: { x: number; y: number }, steps = 20): Promise<void> {
  await mouse(page, "mouseMoved", from.x, from.y, 0);
  await mouse(page, "mousePressed", from.x, from.y, 1);
  for (let i = 1; i <= steps; i++) {
    await mouse(page, "mouseMoved", from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps, 1);
    await Bun.sleep(8);
  }
  await mouse(page, "mouseReleased", to.x, to.y, 1);
  await Bun.sleep(150);
}

const VIRTUAL_KEY_CODES: Record<string, number> = {
  Backspace: 8,
  Tab: 9,
  Enter: 13,
  Escape: 27,
  " ": 32,
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
  Delete: 46,
};

function virtualKeyCode(keyName: string): number | undefined {
  if (keyName in VIRTUAL_KEY_CODES) return VIRTUAL_KEY_CODES[keyName];
  return keyName.length === 1 ? keyName.toUpperCase().charCodeAt(0) : undefined;
}

export async function key(page: Devtools, keyName: string, code: string, modifiers = 0): Promise<void> {
  const windowsVirtualKeyCode = virtualKeyCode(keyName);
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: keyName, code, modifiers, windowsVirtualKeyCode, text: keyName.length === 1 ? keyName : undefined });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: keyName, code, modifiers, windowsVirtualKeyCode });
}

const CANVAS_READY = "Boolean(window.harness && document.querySelector('[data-studio-canvas] canvas'))";

export async function waitReady(page: Devtools, expression = CANVAS_READY): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const ready = await page.evaluate<boolean>(expression).catch(() => false);
    if (ready) return;
    await Bun.sleep(300);
  }
  throw new Error("The editor did not mount.");
}

export interface Harness {
  page: Devtools;
  work: string;
  downloads: string;
  bundlePath: string;
}

export async function navigate(page: Devtools, path: string, ready?: string): Promise<void> {
  await page.send("Page.navigate", { url: `http://127.0.0.1:${PAGE_PORT}${path}` });
  await Bun.sleep(300);
  await waitReady(page, ready);
}

export async function withHarness<T>(run: (harness: Harness) => Promise<T>, options: HarnessOptions = {}): Promise<T> {
  const work = mkdtempSync(join(tmpdir(), "studio-harness-"));
  const downloads = join(work, "downloads");
  mkdirSync(downloads);
  const server = serve(work);
  let browser: ChildProcess | null = null;
  try {
    styles(work);
    if (options.fixtures) {
      mkdirSync(join(work, "fixtures"));
      options.fixtures(join(work, "fixtures"));
    }
    await bundle(work, options);
    browser = spawn(browserPath(), ["--headless=new", ...GPU_FLAGS, ...FRAME_FLAGS, `--remote-debugging-port=${DEBUG_PORT}`, "--window-size=1440,900", "--autoplay-policy=no-user-gesture-required", "--no-first-run", `--user-data-dir=${join(work, "profile")}`, "about:blank"]);
    const page = await devtools(options.path);
    await page.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads, eventsEnabled: true }).catch(() => page.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloads }));
    await page.send("Page.enable");
    await waitReady(page, options.ready);
    const result = await run({ page, work, downloads, bundlePath: join(work, "page.js") });
    page.close();
    return result;
  } finally {
    if (browser) {
      const exited = once(browser, "exit");
      browser.kill();
      await exited;
    }
    server.stop(true);
    try {
      rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch (error) {
      console.warn(`The browser still holds ${work}; it is a temporary folder and can be removed later (${(error as Error).message}).`);
    }
  }
}

export function keepBundle(harness: Harness, destination: string | undefined): void {
  if (destination) copyFileSync(harness.bundlePath, destination);
}
