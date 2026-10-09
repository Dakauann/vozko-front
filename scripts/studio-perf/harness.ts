import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const HERE = import.meta.dir;
export const ROOT = resolve(HERE, "../..");
const PAGE_PORT = 9361;
const DEBUG_PORT = 9362;
const READY_TIMEOUT_MS = 60_000;

export const GPU_FLAGS = process.env.STUDIO_PERF_GPU === "software" ? ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] : ["--use-angle=d3d11", "--enable-gpu-rasterization", "--ignore-gpu-blocklist"];

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

async function bundle(dir: string): Promise<void> {
  const built = await Bun.build({
    entrypoints: [join(HERE, "page.ts")],
    outdir: dir,
    format: "esm",
    target: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
    external: ["pixi.js", "pixi.js/advanced-blend-modes"],
    plugins: [
      {
        name: "harness-stubs",
        setup: (build) => {
          build.onResolve({ filter: /^(next-intl|next\/dynamic|next\/image|next\/link|next\/navigation)$/ }, (args) => ({ path: STUBS[args.path] }));
          build.onResolve({ filter: /^@\/app\/actions\/(?!action-result$)/ }, (args) => ({ path: join(ROOT, "src", args.path.slice(2)) + ".ts", namespace: "action-stub" }));
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
      const file = Bun.file(join(dir, path));
      return file.size > 0 ? new Response(file) : new Response("missing", { status: 404 });
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
  close: () => void;
}

async function devtools(): Promise<Devtools> {
  let target: { webSocketDebuggerUrl: string } | null = null;
  for (let attempt = 0; attempt < 50 && !target; attempt++) {
    await Bun.sleep(200);
    target = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?http://127.0.0.1:${PAGE_PORT}/`, { method: "PUT" })
      .then((response) => response.json())
      .catch(() => null);
  }
  if (!target) throw new Error("The browser did not open its debugging port.");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ready) => socket.addEventListener("open", ready));
  const waiting = new Map<number, (message: { result?: Record<string, unknown>; error?: { message: string } }) => void>();
  let id = 0;
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method === "Runtime.exceptionThrown") console.error("page error:", message.params.exceptionDetails?.exception?.description ?? message.params.exceptionDetails?.text);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") console.error("page console:", message.params.args.map((a: { value?: unknown; description?: string }) => a.value ?? a.description).join(" "));
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
  return { send, evaluate, close: () => socket.close() };
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

export async function key(page: Devtools, keyName: string, code: string, modifiers = 0): Promise<void> {
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: keyName, code, modifiers, text: keyName.length === 1 ? keyName : undefined });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: keyName, code, modifiers });
}

async function waitReady(page: Devtools): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const ready = await page.evaluate<boolean>("Boolean(window.harness && document.querySelector('[data-studio-canvas] canvas'))").catch(() => false);
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

export async function withHarness<T>(run: (harness: Harness) => Promise<T>): Promise<T> {
  const work = mkdtempSync(join(tmpdir(), "studio-harness-"));
  const downloads = join(work, "downloads");
  mkdirSync(downloads);
  const server = serve(work);
  let browser: ChildProcess | null = null;
  try {
    styles(work);
    await bundle(work);
    browser = spawn(browserPath(), ["--headless=new", ...GPU_FLAGS, `--remote-debugging-port=${DEBUG_PORT}`, "--window-size=1440,900", "--no-first-run", `--user-data-dir=${join(work, "profile")}`, "about:blank"]);
    const page = await devtools();
    await page.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads, eventsEnabled: true }).catch(() => page.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloads }));
    await waitReady(page);
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
