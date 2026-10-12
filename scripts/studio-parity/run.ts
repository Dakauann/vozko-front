import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { DOT_FILE, dotArgs } from "./dot-fixture";
import { LOOK_CUBE, LOOK_FILE } from "./lut-fixture";
import { LOTTIE_WASM_PATH } from "./lottie-wasm";

const HERE = import.meta.dir;
const ROOT = resolve(HERE, "../..");
const PAGE_PORT = Number(process.env.STUDIO_PARITY_PORT ?? 9351);
const DEBUG_PORT = PAGE_PORT + 1;
const TIMEOUT_MS = 600_000;
const POLL_MS = 500;
const MIN_PSNR_DB = 35;
const MAX_LATE_SHARE = 0.02;
const PEAK_RANGE = [0.9, 0.97] as const;
const MAX_ANIMATION_DRIFT_MS = 20;
const STRIPES = "geq=lum='255*mod(floor(N/pow(2\\,floor(X*8/W)))\\,2)':cb=128:cr=128";
const QUADRANTS = "drawbox=x=256:y=0:w=256:h=256:color=0x00ff00:t=fill,drawbox=x=0:y=256:w=256:h=256:color=0x0000ff:t=fill,drawbox=x=256:y=256:w=256:h=256:color=0xffffff:t=fill";

type Report = Record<string, Record<string, number | string | null>> & { error?: string };

const GPU_ERROR = /Could not initialize shader|getProgramInfoLog|^ERROR: \d+:\d+|WebGL: [A-Z_]+|CONTEXT_LOST/m;

function consoleText(message: { method?: string; params?: { type?: string; args?: { value?: unknown; description?: string }[]; entry?: { level: string; text: string } } }): string | null {
  if (message.method === "Runtime.consoleAPICalled" && (message.params?.type === "error" || message.params?.type === "warning")) return (message.params.args ?? []).map((arg) => String(arg.value ?? arg.description ?? "")).join(" ");
  if (message.method === "Log.entryAdded" && (message.params?.entry?.level === "error" || message.params?.entry?.level === "warning")) return message.params.entry.text;
  return null;
}

function ffmpeg(args: string[]): void {
  const run = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
  if (run.status !== 0) throw new Error(`ffmpeg failed: ${run.stderr.toString()}`);
}

function fixtures(dir: string): void {
  const video = (size: string, keyframes: string, name: string) =>
    ffmpeg(["-f", "lavfi", "-i", `color=c=black:s=${size}:r=30:d=4,format=yuv420p`, "-vf", STRIPES, "-c:v", "libx264", "-preset", "veryfast", "-crf", "12", "-g", keyframes, "-keyint_min", keyframes, "-sc_threshold", "0", "-bf", "3", "-movflags", "+faststart", join(dir, name)]);
  video("320x180", "15", "proxy.mp4");
  video("1280x720", "120", "original.mp4");
  ffmpeg(["-f", "lavfi", "-i", "color=c=0x996633:s=64x64", "-frames:v", "1", "-pix_fmt", "rgb24", join(dir, "swatch.png")]);
  ffmpeg(["-f", "lavfi", "-i", "color=c=0x00ff00:s=64x64", "-vf", "drawbox=x=32:y=0:w=32:h=64:color=0x996633:t=fill", "-frames:v", "1", "-pix_fmt", "rgb24", join(dir, "green-screen.png")]);
  ffmpeg(["-f", "lavfi", "-i", "color=c=0xff0000:s=512x512", "-vf", QUADRANTS, "-frames:v", "1", "-pix_fmt", "rgb24", join(dir, "quad.png")]);
  for (const [name, hz] of [["low.m4a", 440], ["high.m4a", 1000]] as const) ffmpeg(["-f", "lavfi", "-i", `sine=frequency=${hz}:sample_rate=48000:duration=3`, "-af", "volume=2", "-c:a", "aac", "-b:a", "192k", join(dir, name)]);
  writeFileSync(join(dir, LOOK_FILE), LOOK_CUBE);
  for (const name of ["tone-a.m4a", "tone-b.m4a"]) ffmpeg(["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=3", "-af", "volume=7.2", "-c:a", "aac", "-b:a", "192k", join(dir, name)]);
  ffmpeg(dotArgs(join(dir, DOT_FILE)));
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
<link rel="stylesheet" href="/checks.css">
<script type="importmap">{"imports":{"pixi.js":"/pixi.mjs","pixi.js/advanced-blend-modes":"/blends.mjs"}}</script></head>
<body><script type="module" src="/checks.js"></script></body></html>`;

const BLENDS = `import * as PIXI from "/pixi.mjs";
globalThis.PIXI = { ...PIXI };
${readFileSync(join(ROOT, "node_modules/pixi.js/dist/packages/advanced-blend-modes.js"), "utf8").replaceAll("this.PIXI", "globalThis.PIXI")}
PIXI.extensions.add(...Object.values(globalThis.PIXI).filter((value) => typeof value === "function" && value.extension?.type === PIXI.ExtensionType.BlendMode));`;

function serve(dir: string) {
  const script = (body: BodyInit) => new Response(body, { headers: { "content-type": "text/javascript" } });
  return Bun.serve({
    port: PAGE_PORT,
    fetch: (request) => {
      const path = new URL(request.url).pathname;
      if (path === "/") return new Response(PAGE, { headers: { "content-type": "text/html" } });
      if (path === "/pixi.mjs") return script(Bun.file(join(ROOT, "node_modules/pixi.js/dist/pixi.mjs")));
      if (path === "/blends.mjs") return script(BLENDS);
      if (path === LOTTIE_WASM_PATH) return new Response(Bun.file(join(ROOT, "node_modules/@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm")), { headers: { "content-type": "application/wasm" } });
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

async function devtools(): Promise<{ evaluate: (expression: string) => Promise<unknown>; gpuErrors: Set<string>; close: () => void }> {
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
  const gpuErrors = new Set<string>();
  let id = 0;
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    const text = consoleText(message);
    if (text && GPU_ERROR.test(text)) gpuErrors.add(text);
    waiting.get(message.id)?.(message.result?.result?.value);
    waiting.delete(message.id);
  });
  const send = (method: string, params: object) =>
    new Promise<unknown>((answer) => {
      id += 1;
      waiting.set(id, answer);
      socket.send(JSON.stringify({ id, method, params }));
    });
  await send("Runtime.enable", {});
  await send("Log.enable", {});
  return { evaluate: (expression) => send("Runtime.evaluate", { expression, returnByValue: true }), gpuErrors, close: () => socket.close() };
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
    return { ...report, gpu: { errors: [...page.gpuErrors].join(" | ") } };
  } finally {
    const exited = once(browser, "exit");
    browser.kill();
    await exited;
  }
}

function verdicts(report: Report): [string, boolean][] {
  const { proxy, original, stills, export: exported, paint, transitions, text, speed, grade, gradientMap, layerPaint, repeats, masks, gif, webp, vfx, vfxExport } = report;
  const rangeOk = (range: Report[string] | undefined, wrongKey: string, lengthKey: string) =>
    range?.status === "done" && Number(range.frames) > 0 && range.frames === range.expectedFrames && range[wrongKey] === 0 && range.durationMs === range[lengthKey];
  const animationOk = (animation: Report[string] | undefined) =>
    animation?.status === "done" && animation.frames === animation.expectedFrames && animation.wrong === 0 && Math.abs(Number(animation.durationMs) - Number(animation.filmMs)) <= MAX_ANIMATION_DRIFT_MS;
  return [
    ["GPU programs: every shader compiles and links, no WebGL errors in the console", report.gpu?.errors === ""],
    ["Proxy decoding: every seek, step and scrub shows the exact frame", proxy?.wrong === 0],
    ["Proxy playback: no blank frames and at most 2% late", proxy?.blank === 0 && Number(proxy?.late) <= Number(proxy?.renders) * MAX_LATE_SHARE],
    ["Long keyframe original: every seek, step and scrub shows the exact frame", original?.wrong === 0],
    ["Timeline stills: exact frames from the worker", stills?.wrong === 0 && stills?.fallbacks === 0],
    ["Browser export: encoded as H.264 and AAC", exported?.status === "done"],
    ["Browser export: every frame shows its own source frame", exported?.wrongSource === 0 && exported?.frames === exported?.expectedFrames],
    [`Browser export: at least ${MIN_PSNR_DB} dB PSNR against the renderer`, Number(exported?.psnrMin) >= MIN_PSNR_DB],
    ["Browser export: sound peaks held at the 0.95 limit", Number(exported?.audioPeak) >= PEAK_RANGE[0] && Number(exported?.audioPeak) <= PEAK_RANGE[1]],
    ["Sound export: a constant power crossfade holds the level through the cut and a constant gain one dips by the shared curve", report.sound?.crossfadeOk === true],
    ["Sound export: a hard left and a half right pan land on each side at the shared pan law", report.sound?.panOk === true],
    ["Color keys: every frame shows the blended key color", paint?.wrong === 0 && Number(paint?.frames) > 0],
    ["Transitions: a wipe reveals the incoming clip and a dissolve blends both", transitions?.wipeOk === true && transitions?.dissolveOk === true],
    ["Entrance and exit: a wipe reveals a small clip inside its own box and an exit iris hides the clip from the middle out", report.edgeTransitions?.boxOk === true && report.edgeTransitions?.inverseOk === true],
    ["New wipes: blinds, blocks, radial and gradient maps reveal the pixels the shared field math picks, a library image map included", report.edgeTransitions?.fieldsOk === true && report.edgeTransitions?.imageMapOk === true],
    ["Transition galleries: every cut and entrance kind has a preview drawn by the GPU renderer, changed from both plain frames, and cached", report.transitionPreviews?.previewsOk === true],
    ["Text animators: each word waits for its turn and then settles", text?.staggerOk === true],
    ["Color grade: the GPU grade matches the shared pixel math", grade?.gradeOk === true],
    ["Curves: the GPU curves match the shared curve table", report.colorFinish?.curvesOk === true],
    ["LUT: the GPU applies a library .cube by the shared trilinear math at its intensity", report.colorFinish?.lutOk === true],
    ["Selective color: the GPU keeps or removes hues by the shared secondary math", report.colorFinish?.hslOk === true],
    ["Color finish: grade, LUT, curves and secondary chain in the shared order", report.colorFinish?.chainOk === true],
    ["Speed curve: a remapped clip shows the source frame the shared curve picks at every export frame", report.remap?.remapOk === true],
    ["Frame mix: slow motion blends the two neighbouring source frames by the fractional position", report.remap?.frameMixOk === true],
    ["Gradient map: the GPU map of an image layer matches the shared lookup table", gradientMap?.gradientMapOk === true],
    ["Layer paint: fill lists, outside strokes, a hard drop shadow and a stripe pattern land on the right pixels", layerPaint?.layerPaintOk === true],
    ["Repeat: a mirror copy lands across its axis and grid copies land in their cells", repeats?.repeatOk === true],
    ["Components: an instance on the GPU draws its parts, overrides included, where the same layers placed by hand land", report.components?.componentOk === true],
    ["Auto layout: a hug text is measured to the width of the drawn letters", report.autoLayout?.autoLayoutOk === true],
    ["Clip speed: 2x shows every other source frame and reverse plays the window backwards", speed?.fastWrong === 0 && speed?.backWrong === 0 && Number(speed?.fastFrames) > 0 && Number(speed?.backFrames) > 0],
    ["Masks: an animated clip mask fades in and a matte clips to the masked clip", masks?.maskOk === true],
    ["Placement: an anchored, turned, unevenly scaled and mirrored clip lands on the pixels of the shared placement and path math", report.placement?.placementOk === true],
    ["Parenting: a clip parented to a turning, growing null lands on the pixels of the parent transform composed by hand", report.parenting?.parentingOk === true],
    ["Groups: a scaled, turning, faded and masked group equals its composed inner frame placed by the shared placement and mask math", report.groups?.groupOk === true],
    ["Groups: inner sound plays at the group volume inside the group window and stays silent outside it", report.groupSound?.soundOk === true],
    ["Behaviors: a wiggle and a ping pong loop land on the pixels of the shared behavior math, checked against the math written by hand", report.behaviors?.behaviorsOk === true],
    ["Behaviors: the same film renders the same pixels twice", report.behaviors?.repeatOk === true],
    ["Path morph: a square keyed into a star fills, at the middle frame, exactly the shape the shared interpolation draws, matches the same shape drawn still and renders the same pixels twice", report.morph?.morphOk === true],
    ["Layer styles on video: an outside stroke and an outer glow on a video clip land in the bands the shared effect math puts around its silhouette, never over the picture, and render the same pixels twice", report.clipStyle?.styleOk === true],
    ["Motion blur: a fast swatch blurs along its path to the average of the shared placement samples, in one pass and in chunked passes", report.motionBlur?.motionBlurOk === true],
    ["Motion blur: the same film renders the same pixels twice", report.motionBlur?.repeatOk === true],
    ["3D rotation: a picture turned 45 degrees in Y with perspective, and one hinged on its top edge, land on the pixels of the shared projection", report.tilt?.clipOk === true],
    ["3D rotation: letters flipped 90 degrees on a flat lens vanish, and letters turned 60 degrees narrow or shorten by the shared projection", report.tilt?.hiddenOk === true && report.tilt?.flipOk === true],
    ["Adjustment clip: curves inside an ellipse mask equal the shared curve table inside and leave the picture untouched outside", report.adjustmentMask?.maskedCurvesOk === true],
    ["Adjustment clip: a 2D camera pans, zooms and turns everything below onto the pixels of the shared camera math", report.adjustmentCamera?.cameraOk === true],
    ["Chroma key: the green screen turns transparent and the subject keeps the shared pixel math", report.chroma?.chromaOk === true],
    ["Chroma key on image layers: the CPU keyer matches the shared math and the GPU keyer across the edge", report.chroma?.layerChromaOk === true],
    ["Line animation: a bend wave and a keyed trim draw the stroke where the shared geometry puts it", report.line?.lineOk === true],
    ["Line animation: the same film renders the same pixels twice", report.line?.repeatOk === true],
    ["Path operators: a keyed offset grows past the edge, a zig zag peaks and notches and a subtract merge cuts a hole where the shared geometry puts them, the same each render", report.pathOps?.pathOpsOk === true],
    ["Repeater: linear copies land where the shared repeat math places them, slide with a keyed shift, fade to the end opacity and render the same twice", report.repeater?.repeaterOk === true],
    ["Efeitos panel: every effect has a preview drawn by the GPU renderer beside the plain sample it changes, and both are cached", report.thumbnails?.thumbnailsOk === true],
    ["Blend modes: every blend mode matches the shared blend math with the clip below as the base", report.blend?.blendOk === true],
    ["Blend modes on media: an image clip adds, multiplies and screens over the clip below by the shared blend math", report.clipBlend?.clipBlendOk === true],
    ["Mattes: a luma matte shows the clip by the brightness of the clip below, by the shared matte math", report.mattes?.lumaMatteOk === true],
    ["Mattes: an inverted matte shows the clip only where the clip below has no picture", report.mattes?.invertedMatteOk === true],
    ["Luma key: dark pixels turn transparent and the ramp follows the shared luma key math", report.lumaKey?.lumaKeyOk === true],
    ["VFX: the GPU vignette matches the shared math on an effect clip and inside a clip", vfx?.vignetteOk === true],
    ["VFX: the same effect stack renders the same pixels twice and in any frame order", vfx?.repeatOk === true && vfx?.seekOk === true],
    ["VFX: grain holds between its refreshes and changes at the next one", vfx?.grainOk === true],
    ["VFX: an effect clip shake moves the picture by the shared shake offset", vfx?.shakeOk === true],
    [`VFX export: every frame at least ${MIN_PSNR_DB} dB PSNR against the renderer`, vfxExport?.status === "done" && vfxExport.frames === vfxExport.expectedFrames && Number(vfxExport.psnrMin) >= MIN_PSNR_DB],
    [`Still VFX: each still effect on a photo and on the artboard matches between the GPU view and the export at ${MIN_PSNR_DB} dB, changes the picture and exports the same pixels twice`, report.stillVfx?.stillVfxOk === true],
    [`Effects packs: every blur, distortion, stylize, generator, sound and time effect exports every frame within ${MIN_PSNR_DB} dB of the GPU view, changes the picture and renders the same pixels twice`, report.vfxPack?.vfxPackOk === true],
    ["GIF export: one frame per step of the chosen rate, each showing its own source frame, lasting the whole film", animationOk(gif)],
    ["WebP export: one frame per step of the chosen rate, each showing its own source frame, lasting the whole film", animationOk(webp)],
    ["Pixels: a brush stroke, an erase and a photo mask land the same on the GPU and in the export", report.pixels?.pixelsOk === true],
    ["Counters: the digits at each sampled frame match the text of the expected value and not its neighbour", report.glyphs?.digitsOk === true],
    ["Text on a path: an arc lands where the curve control draws it and slides along the shared path math", report.glyphs?.arcOk === true],
    ["Text on a path: the same film renders the same pixels twice", report.glyphs?.repeatOk === true],
    ["Text animators: range shapes, orders (center out, edges in, seeded random) and a keyed offset hide exactly the letters the shared selector math picks at each sampled frame", report.animators?.unitsOk === true],
    ["Text animators: a fill color animator paints the selected letters and leaves the others", report.animators?.colorOk === true],
    ["Rich text: a two color, two weight line paints each color on its own word", report.richText?.colorsOk === true],
    ["Rich text: only the bold word gains ink, the other word keeps its weight", report.richText?.weightOk === true],
    ["Range export MP4: exactly one frame per step of the range, each showing its own source frame, lasting exactly the range", rangeOk(report.rangeMp4, "wrongSource", "spanMs")],
    ["Range export GIF: exactly one frame per step of the range, each showing its own source frame, lasting exactly the range", rangeOk(report.rangeGif, "wrong", "filmMs")],
    ["Range export WebP: exactly one frame per step of the range, each showing its own source frame, lasting exactly the range", rangeOk(report.rangeWebp, "wrong", "filmMs")],
    ["Frame export: a PNG of the whole frame showing the source frame at the asked moment", report.frame?.status === "done" && report.frame.type === "image/png" && report.frame.shown === report.frame.expected],
    ["Frames: a photo filling a circle frame lands inside the circle the same on the GPU, in the export and as a masked video clip", report.frames?.frameOk === true],
    ["Animated stickers: every sticker's last video frame matches its image editor version", report.stickers?.stickerOk === true],
    ["Point tracking: a moving dot is tracked in the media worker on every frame within a pixel", report.tracking?.trackOk === true],
    ["Point tracking: a swatch linked to the tracked point follows it in the export, by the shared math", report.tracking?.followOk === true],
    ["Stabilization: a clip stabilized on the tracked dot holds the dot still in the export", report.tracking?.steadyOk === true],
    ["Guide clips: a guide picture shows in the renderer but never in the PNG or MP4 export, and a guide sound is silent in the export", report.guides?.guideOk === true],
    ["Charts: each bar of a bar chart rises from the shared baseline to the height its value gives, where the shared chart geometry puts it", report.charts?.barsOk === true],
    ["Charts: each pie slice covers the angle its share of the total gives, starting at twelve o'clock", report.charts?.slicesOk === true],
    ["Charts: stacked bars, lines, a donut, stacked areas and a scatter draw the same on the GPU and in the Konva fallback", report.charts?.fallbackOk === true],
    ["Chart animation: a grow entrance shows each bar at half its height from the baseline at the middle of its run", report.charts?.growOk === true],
    ["Lottie import: the converted clips match the reference Lottie renderer at four moments within tolerance", report.lottie?.lottieOk === true],
    ["Lottie import: the exported frame of the converted clips matches the GPU frame", report.lottie?.exportOk === true],
    ["QR codes: a short link code and a WhatsApp code drawn by the GPU decode back to the exact link with an independent reader", report.generated?.qrOk === true],
    ["QR codes: the same codes drawn by the Konva fallback decode back to the exact link", report.generated?.qrFallbackOk === true],
    ["QR codes: a code overlay in an exported video frame decodes back to the exact link", report.generated?.qrExportOk === true],
    ["Tables: every cell border lands on the pixels the shared table layout gives, on the GPU", report.generated?.tableOk === true],
    ["Tables: the Konva fallback puts every cell border on the same pixels", report.generated?.tableFallbackOk === true],
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
  console.log(JSON.stringify({ proxy: report.proxy, original: report.original, stills: report.stills, export: report.export, sound: report.sound, paint: report.paint, transitions: report.transitions, edgeTransitions: report.edgeTransitions, transitionPreviews: report.transitionPreviews, text: report.text, speed: report.speed, grade: report.grade, colorFinish: report.colorFinish, remap: report.remap, gradientMap: report.gradientMap, layerPaint: report.layerPaint, repeats: report.repeats, components: report.components, autoLayout: report.autoLayout, masks: report.masks, placement: report.placement, parenting: report.parenting, groups: report.groups, groupSound: report.groupSound, tracking: report.tracking, behaviors: report.behaviors, morph: report.morph, clipStyle: report.clipStyle, motionBlur: report.motionBlur, tilt: report.tilt, adjustmentMask: report.adjustmentMask, adjustmentCamera: report.adjustmentCamera, guides: report.guides, chroma: report.chroma, blend: report.blend, clipBlend: report.clipBlend, mattes: report.mattes, lumaKey: report.lumaKey, line: report.line, pathOps: report.pathOps, repeater: report.repeater, thumbnails: report.thumbnails, gif: report.gif, webp: report.webp, vfx: report.vfx, vfxExport: report.vfxExport, stillVfx: report.stillVfx, vfxPack: report.vfxPack, pixels: report.pixels, glyphs: report.glyphs, animators: report.animators, richText: report.richText, rangeMp4: report.rangeMp4, rangeGif: report.rangeGif, rangeWebp: report.rangeWebp, frame: report.frame, frames: report.frames, stickers: report.stickers, charts: report.charts, generated: report.generated, lottie: report.lottie, gpu: report.gpu }, null, 2));
  const results = verdicts(report);
  for (const [name, ok] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  passed = results.every(([, ok]) => ok);
} finally {
  server.stop(true);
  try {
    rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  } catch (error) {
    console.warn(`could not remove ${work}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
process.exit(passed ? 0 : 1);
