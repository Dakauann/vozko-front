import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ReplicationScore } from "@/lib/studio/agent/evals/replication-score";
import type { StudioDocument } from "@/lib/studio/document";

import { withHarness } from "../studio-perf/harness";
import { PHOTO_HARNESS } from "./library-photos";
import type { Inspection, Reference } from "./model";
import { sotaReferences } from "./references-sota";

const HERE = import.meta.dir;
const OUT = join(process.env.ELO_BENCH_OUT ?? join(HERE, ".out"), "sota");
const CROPS = process.env.SOTA_CROPS ?? "";
const PAIRS = process.env.SOTA_PAIRS ?? join(OUT, "pairs");

function documentOf(reference: Reference): StudioDocument {
  return reference.kind === "image" ? { schema: "studio.image", version: 2, artboards: [reference.artboard] } : reference.doc;
}

function saveImage(path: string, dataUrl: string): void {
  writeFileSync(path, Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
}

function cropOf(id: string): string | null {
  const file = CROPS ? join(CROPS, `${id}.png`) : "";
  return file && existsSync(file) ? `data:image/png;base64,${readFileSync(file).toString("base64")}` : null;
}

const wanted = new Set(process.argv.slice(2));
mkdirSync(OUT, { recursive: true });
mkdirSync(PAIRS, { recursive: true });

await withHarness(
  async ({ page }) => {
    page.quiet = true;
    for (const reference of sotaReferences().filter((candidate) => wanted.size === 0 || wanted.has(candidate.id))) {
      const doc = documentOf(reference);
      const invalid = await page.evaluate<string | null>(`window.bench.validate(${JSON.stringify(reference.kind)}, ${JSON.stringify(doc)})`);
      const seen = await page.evaluate<Inspection>(`window.bench.inspect(${JSON.stringify(doc)})`);
      saveImage(join(OUT, `${reference.id}.jpg`), seen.image);
      const self = await page.evaluate<{ score: ReplicationScore; ssim: number }>(`window.bench.compare(${JSON.stringify(doc)}, ${JSON.stringify(doc)})`);
      const crop = cropOf(reference.id);
      if (crop) saveImage(join(PAIRS, `${reference.id}.jpg`), await page.evaluate<string>(`window.bench.sideBySide(${JSON.stringify(crop)}, ${JSON.stringify(seen.image)})`));
      console.log(`${reference.id}: valid=${invalid ?? "yes"} block=${self.score.blockMatch.toFixed(3)} matched=${self.score.matched}/${self.score.referenceElements} ssim=${self.ssim.toFixed(3)} findings=${seen.findings.length} checks=${seen.checks.length}`);
    }
    if (page.errors.length > 0) console.warn(page.errors.slice(0, 5).join("\n"));
  },
  { entry: join(HERE, "page.ts"), path: "/", ready: "Boolean(window.bench)", worker: true, ...PHOTO_HARNESS },
);
