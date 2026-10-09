import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const HERE = import.meta.dir;
const ROOT = resolve(HERE, "../..");
const PAGE_PORT = 9351;
const DEBUG_PORT = 9352;
const TIMEOUT_MS = 300_000;
const POLL_MS = 500;
const MIN_PSNR_DB = 35;
const MAX_LATE_SHARE = 0.02;
const PEAK_RANGE = [0.9, 0.97] as const;
const STRIPES = "geq=lum='255*mod(floor(N/pow(2\\,floor(X*8/W)))\\,2)':cb=128:cr=128";

type Report = Record<string, Record<string, number | string | null>> & { error?: string };

function ffmpeg(args: string[]): void {
  const run = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
  if (run.status !== 0) throw new Error(`ffmpeg failed: ${run.stderr.toString()}`);
}

function fixtures(dir: string): void {
  const video = (size: string, keyframes: string, name: string) =>
    ffmpeg(["-f", "lavfi", "-i", `color=c=black:s=${size}:r=30:d=4,format=yuv420p`, "-vf", STRIPES, "-c:v", "libx264", "-preset", "veryfast", "-crf", "12", "-g", keyframes, "-keyint_min", keyframes, "-sc_threshold", "0", "-bf", "3", "-movflags", "+faststart", join(dir, name)]);
  video("320x180", "15", "proxy.mp4");
  video("1280x720", "120", "original.mp4");
  for (const name of ["tone-a.m4a", "tone-b.m4a"]) ffmpeg(["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=3", "-af", "volume=7.2", "-c:a", "aac", "-b:a", "192k", join(dir, name)]);
}

async function bundle(dir: string): Promise<void> {
  const page = await Bun.build({
    entrypoints: [join(HERE, "checks.ts")],
    outdir: dir,
    format: "esm",
    target: "browser",
    external: ["pixi.js", "pixi.js/advanced-blend-modes"],
    plugins: [{ name: "parity-stubs", setup: (build) => void build.onResolve({ filter: /^@\/app\/actions\/medias$/ }, () => ({ path: join(HERE, "stub-medias.ts") })) }],
  });
  const worker = await Bun.build({ entrypoints: [join(ROOT, "src/components/studio/media/media.worker.ts")], outdir: dir, format: "esm", target: "browser" });
  if (!page.success || !worker.success) throw new Error([...page.logs, ...worker.logs].join("\n"));
}

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><script>window.process = { env: {} };</script>
<script type="importmap">{"imports":{"pixi.js":"/pixi.mjs","pixi.js/advanced-blend-modes":"/blends.mjs"}}</script></head>
<body><script type="module" src="/checks.js"></script></body></html>`;

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
      if (path.startsWith("/fixtures/")) return new Response(Bun.file(join(dir, path.slice("/fixtures/".length))));
      return new Response(Bun.file(join(dir, path)));
    },
  });
}

function browserPath(): string {
  const configured = process.env.STUDIO_PARITY_BROWSER;
  if (configured) return configured;
  const candidates: Record<string, string[]> = {
    win32: ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"],
    darwin: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
    linux: ["/usr/bin/chromium", "/usr/bin/google-chrome"],
  };
  const found = (candidates[process.platform] ?? []).find((path) => existsSync(path));
  if (!found) throw new Error("No Chromium based browser found. Set STUDIO_PARITY_BROWSER.");
  return found;
}

async function devtools(): Promise<{ evaluate: (expression: string) => Promise<unknown>; close: () => void }> {
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
  const waiting = new Map<number, (value: unknown) => void>();
  let id = 0;
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    waiting.get(message.id)?.(message.result?.result?.value);
    waiting.delete(message.id);
  });
  const evaluate = (expression: string) =>
    new Promise<unknown>((answer) => {
      id += 1;
      waiting.set(id, answer);
      socket.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
    });
  return { evaluate, close: () => socket.close() };
}

async function collect(profile: string): Promise<Report> {
  const browser = spawn(browserPath(), ["--headless=new", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--autoplay-policy=no-user-gesture-required", `--remote-debugging-port=${DEBUG_PORT}`, "--no-first-run", `--user-data-dir=${profile}`, "about:blank"]);
  try {
    const page = await devtools();
    const deadline = Date.now() + TIMEOUT_MS;
    let report: Report = {};
    while (Date.now() < deadline && !report.done && !report.error) {
      await Bun.sleep(POLL_MS);
      report = JSON.parse(String((await page.evaluate("JSON.stringify(window.parity ?? {})")) ?? "{}"));
    }
    page.close();
    return report;
  } finally {
    const exited = once(browser, "exit");
    browser.kill();
    await exited;
  }
}

function verdicts(report: Report): [string, boolean][] {
  const { proxy, original, stills, export: exported } = report;
  return [
    ["Proxy decoding: every seek, step and scrub shows the exact frame", proxy?.wrong === 0],
    ["Proxy playback: no blank frames and at most 2% late", proxy?.blank === 0 && Number(proxy?.late) <= Number(proxy?.renders) * MAX_LATE_SHARE],
    ["Long keyframe original: every seek, step and scrub shows the exact frame", original?.wrong === 0],
    ["Timeline stills: exact frames from the worker", stills?.wrong === 0 && stills?.fallbacks === 0],
    ["Browser export: encoded as H.264 and AAC", exported?.status === "done"],
    ["Browser export: every frame shows its own source frame", exported?.wrongSource === 0 && exported?.frames === exported?.expectedFrames],
    [`Browser export: at least ${MIN_PSNR_DB} dB PSNR against the renderer`, Number(exported?.psnrMin) >= MIN_PSNR_DB],
    ["Browser export: sound peaks held at the 0.95 limit", Number(exported?.audioPeak) >= PEAK_RANGE[0] && Number(exported?.audioPeak) <= PEAK_RANGE[1]],
  ];
}

const work = mkdtempSync(join(tmpdir(), "studio-parity-"));
const server = serve(work);
let passed = false;
try {
  fixtures(work);
  await bundle(work);
  const report = await collect(join(work, "profile"));
  if (report.error) throw new Error(report.error);
  console.log(JSON.stringify({ proxy: report.proxy, original: report.original, stills: report.stills, export: report.export }, null, 2));
  const results = verdicts(report);
  for (const [name, ok] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  passed = results.every(([, ok]) => ok);
} finally {
  server.stop(true);
  rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
}
process.exit(passed ? 0 : 1);
