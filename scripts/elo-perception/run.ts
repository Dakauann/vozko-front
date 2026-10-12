import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { withHarness } from "../studio-perf/harness";
import { PHOTO, PRODUCT } from "./corpus";

const HERE = import.meta.dir;
export const OUT = process.env.ELO_PERCEPTION_OUT ?? join(HERE, ".out");

function ffmpeg(args: string[]): void {
  const run = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
  if (run.status !== 0) throw new Error(`ffmpeg failed: ${run.stderr.toString()}`);
}

function fixtures(dir: string): void {
  ffmpeg(["-f", "lavfi", "-i", "mandelbrot=s=1200x800:maxiter=400", "-frames:v", "1", "-pix_fmt", "rgb24", join(dir, PHOTO)]);
  ffmpeg(["-f", "lavfi", "-i", "testsrc2=s=800x660", "-frames:v", "1", "-pix_fmt", "rgb24", join(dir, PRODUCT)]);
}

function saveImage(path: string, dataUrl: string): void {
  writeFileSync(path, Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
}

mkdirSync(join(OUT, "images"), { recursive: true });
const mode = process.argv[2] ?? "render";

const results = await withHarness(
  async ({ page }) => {
    page.quiet = true;
    if (mode === "probe") return [await page.evaluate<Record<string, unknown>>("window.perception.probe()")];
    const count = await page.evaluate<number>("window.perception.count");
    const rendered: Record<string, unknown>[] = [];
    for (let index = 0; index < count; index++) {
      const result = await page.evaluate<Record<string, unknown>>(`window.perception.render(${index})`);
      const id = String(result.id);
      for (const key of Object.keys(result).filter((k) => typeof result[k] === "string" && String(result[k]).startsWith("data:image/"))) {
        saveImage(join(OUT, "images", `${id}.${key}.jpg`), String(result[key]));
        delete result[key];
      }
      const overlays = (result.channels as { images?: Record<string, string> } | undefined)?.images ?? {};
      for (const [name, url] of Object.entries(overlays)) saveImage(join(OUT, "images", `${id}.${name}.jpg`), url);
      if (result.channels) delete (result.channels as { images?: unknown }).images;
      rendered.push(result);
      console.log(`rendered ${id}`);
    }
    const videoCount = await page.evaluate<number>("window.perception.videos");
    const films: Record<string, unknown>[] = [];
    for (let index = 0; index < videoCount; index++) {
      const result = await page.evaluate<Record<string, unknown>>(`window.perception.renderVideo(${index})`);
      for (const key of ["sheet", "strip"]) {
        saveImage(join(OUT, "images", `${result.id}.${key}.jpg`), String(result[key]));
        delete result[key];
      }
      films.push(result);
      console.log(`rendered ${result.id}`);
    }
    writeFileSync(join(OUT, "rendered-video.json"), JSON.stringify(films, null, 2));
    if (page.errors.length > 0) console.warn(page.errors.slice(0, 5).join("\n"));
    return rendered;
  },
  { entry: join(HERE, "page.ts"), path: "/", ready: "Boolean(window.perception)", worker: true, overrides: { "@/app/actions/medias": join(HERE, "../studio-parity/stub-medias.ts") }, fixtures },
);

writeFileSync(join(OUT, mode === "probe" ? "probe.json" : "rendered.json"), JSON.stringify(results, null, 2));
if (mode === "probe") console.log(JSON.stringify(results[0]));
