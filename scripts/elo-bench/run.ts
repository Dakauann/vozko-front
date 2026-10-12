import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { FONT_IDS } from "@/lib/studio/fonts";
import type { StudioDocument } from "@/lib/studio/document";
import type { ReplicationScore } from "@/lib/studio/agent/evals/replication-score";

import { withHarness, type Devtools } from "../studio-perf/harness";
import { briefs } from "./briefs";
import { BENCH_PROJECT_ID, openSpecOf, type Inspection, type Reference } from "./model";
import { references } from "./references";
import { creativityInputs, judgeInputs, onlyRound, pairwiseInputs, runKey, type GradedRun, type BenchRun } from "./grading";
import { libraryPhotosOf, PHOTO_HARNESS } from "./library-photos";
import { writeReport, type TierOf } from "./report";
import { complexityOf, costTierOf, TIER_RULE } from "./complexity";
import { extendedCorpus } from "./references-extended";

const HERE = import.meta.dir;
export const OUT = process.env.ELO_BENCH_OUT ?? join(HERE, ".out");
const RESULTS = join(OUT, "bench-results.json");
const GRADED = join(OUT, "graded.json");
const JUDGE_INPUTS = join(OUT, "judge-inputs.json");

function saveImage(path: string, dataUrl: string): void {
  writeFileSync(path, Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
}

function documentOf(reference: Reference): StudioDocument {
  return reference.kind === "image" ? { schema: "studio.image", version: 2, artboards: [reference.artboard] } : reference.doc;
}

async function inspect(page: Devtools, doc: StudioDocument): Promise<Inspection> {
  return page.evaluate<Inspection>(`window.bench.inspect(${JSON.stringify(doc)})`);
}

async function renderReferences(page: Devtools): Promise<void> {
  mkdirSync(join(OUT, "refs"), { recursive: true });
  const rendered = [];
  const tierOf = tiers();
  for (const reference of references()) {
    const doc = documentOf(reference);
    const invalid = await page.evaluate<string | null>(`window.bench.validate(${JSON.stringify(reference.kind)}, ${JSON.stringify(doc)})`);
    if (invalid) throw new Error(`reference ${reference.id} is not a valid document: ${invalid}`);
    const seen = await inspect(page, doc);
    const image = `refs/${reference.id}.jpg`;
    saveImage(join(OUT, image), seen.image);
    rendered.push({ id: reference.id, title: reference.title, kind: reference.kind, origin: reference.origin, tier: costTierOf(tierOf.get(reference.id), reference.kind === "video"), open: openSpecOf(reference), image, photos: libraryPhotosOf(reference.id), findings: seen.findings, checks: seen.checks, legibility: seen.legibility });
    console.log(`reference ${reference.id}: ${seen.findings.length} findings, ${seen.checks.length} checks`);
  }
  writeFileSync(join(OUT, "bench-inputs.json"), JSON.stringify({ project: BENCH_PROJECT_ID, fonts: FONT_IDS, references: rendered, briefs: briefs().map((brief) => ({ ...brief, tier: costTierOf(tierOf.get(brief.id), brief.open.kind === "video"), photos: libraryPhotosOf(brief.id) })) }, null, 2));
}


async function gradeRuns(page: Devtools): Promise<void> {
  const runs = benchRuns();
  if (runs.length === 0) {
    console.log(`no live results yet at ${RESULTS}; run the backend bench first`);
    return;
  }
  mkdirSync(join(OUT, "runs"), { recursive: true });
  const byId = new Map(references().map((reference) => [reference.id, reference]));
  const fresh = process.argv.includes("--fresh");
  const previous = new Map(!fresh && existsSync(GRADED) ? (JSON.parse(readFileSync(GRADED, "utf8")) as GradedRun[]).map((entry) => [entry.key, entry]) : []);
  const graded: GradedRun[] = [];
  for (const run of runs) {
    const key = runKey(run);
    const known = previous.get(key);
    if (known && known.run.cost_usd === run.cost_usd && known.run.outcome === run.outcome) {
      graded.push({ ...known, run, versus: known.versus ?? (await versusOf(page, run, known.image, key)) });
      continue;
    }
    if (!run.document) {
      graded.push({ key, run, image: null, inspection: null, replication: null, pair: null });
      continue;
    }
    const seen = await inspect(page, run.document);
    const image = seen.image ? `runs/${key}.jpg` : null;
    if (image) saveImage(join(OUT, image), seen.image);
    let replication: { score: ReplicationScore; ssim: number } | null = null;
    let pair: string | null = null;
    const reference = run.track === "replicate" ? byId.get(run.item) : undefined;
    if (reference && seen.image) {
      const refDoc = documentOf(reference);
      replication = await page.evaluate(`window.bench.compare(${JSON.stringify(refDoc)}, ${JSON.stringify(run.document)})`);
      const refSeen = await inspect(page, refDoc);
      pair = `runs/${key}.pair.jpg`;
      saveImage(join(OUT, pair), await page.evaluate<string>(`window.bench.sideBySide(${JSON.stringify(refSeen.image)}, ${JSON.stringify(seen.image)})`));
    }
    graded.push({ key, run, image, inspection: { findings: seen.findings, checks: seen.checks, legibility: seen.legibility, valid: seen.valid }, replication, pair, versus: await versusOf(page, run, image, key) });
    console.log(`graded ${key}`);
  }
  writeFileSync(GRADED, JSON.stringify(graded, null, 2));
  writeFileSync(JUDGE_INPUTS, JSON.stringify(judgeInputs(graded, briefs(), byId), null, 2));
  writeFileSync(join(OUT, "creativity-inputs.json"), JSON.stringify(creativityInputs(graded, briefs()), null, 2));
  writeFileSync(join(OUT, "pairwise-inputs.json"), JSON.stringify(pairwiseInputs(graded, briefs()), null, 2));
}

function benchRuns(): BenchRun[] {
  const files = readdirSync(OUT).filter((name) => /^bench-results.*\.json$/.test(name) && statSync(join(OUT, name)).isFile()).sort();
  const seen = new Map<string, BenchRun>();
  for (const name of files) for (const run of JSON.parse(readFileSync(join(OUT, name), "utf8")) as BenchRun[]) if (!seen.has(runKey(run))) seen.set(runKey(run), run);
  return [...seen.values()];
}

function dataUrlOf(file: string): string {
  return `data:image/jpeg;base64,${readFileSync(join(OUT, file)).toString("base64")}`;
}

async function versusOf(page: Devtools, run: BenchRun, image: string | null, key: string): Promise<{ eloLeft: string; realLeft: string } | null> {
  const real = `refs/${run.item}.jpg`;
  if (run.track !== "brief" || !image || !existsSync(join(OUT, real))) return null;
  const elo = dataUrlOf(image);
  const reference = dataUrlOf(real);
  const eloLeft = `runs/${key}.vs-elo-left.jpg`;
  const realLeft = `runs/${key}.vs-real-left.jpg`;
  saveImage(join(OUT, eloLeft), await page.evaluate<string>(`window.bench.sideBySide(${JSON.stringify(elo)}, ${JSON.stringify(reference)})`));
  saveImage(join(OUT, realLeft), await page.evaluate<string>(`window.bench.sideBySide(${JSON.stringify(reference)}, ${JSON.stringify(elo)})`));
  return { eloLeft, realLeft };
}

function writeRoundInputs(name: string, round: string, items: readonly string[]): void {
  const model = process.env.ELO_BENCH_MODEL ?? "";
  const graded = onlyRound(JSON.parse(readFileSync(GRADED, "utf8")) as GradedRun[], round, items).filter((entry) => model === "" || entry.run.model === model);
  const pairwise = pairwiseInputs(graded, briefs());
  const creativity = creativityInputs(graded, briefs());
  writeFileSync(join(OUT, `pairwise-inputs-${name}.json`), JSON.stringify(pairwise, null, 2));
  const rubric = judgeInputs(graded, briefs(), new Map(references().map((reference) => [reference.id, reference])));
  writeFileSync(join(OUT, `creativity-inputs-${name}.json`), JSON.stringify(creativity, null, 2));
  writeFileSync(join(OUT, `judge-inputs-${name}.json`), JSON.stringify(rubric, null, 2));
  console.log(`pairwise-inputs-${name}.json: ${pairwise.jobs.length} jobs; creativity-inputs-${name}.json: ${creativity.jobs.length} jobs; judge-inputs-${name}.json: ${rubric.jobs.length} jobs`);
}

const mode = process.argv[2] ?? "all";
mkdirSync(OUT, { recursive: true });

if (mode === "inputs") writeRoundInputs(process.argv[3] ?? "round", process.argv[4] ?? "2", process.argv.slice(5));

if (mode !== "report" && mode !== "inputs" && mode !== "items") {
  await withHarness(
    async ({ page }) => {
      page.quiet = true;
      if (mode === "render" || mode === "all") await renderReferences(page);
      if (mode === "grade" || mode === "all") await gradeRuns(page);
      if (page.errors.length > 0) console.warn(page.errors.slice(0, 5).join("\n"));
    },
    { entry: join(HERE, "page.ts"), path: "/", ready: "Boolean(window.bench)", worker: true, ...PHOTO_HARNESS },
  );
}

function tiers(): Map<string, TierOf> {
  const extended = extendedCorpus();
  const ids = new Set(extended.map((entry) => entry.id));
  const all: [Reference, boolean][] = [
    ...references().filter((reference) => !ids.has(reference.id)).map((reference): [Reference, boolean] => [reference, true]),
    ...extended.map((entry): [Reference, boolean] => {
      const made = entry.make();
      return ["tracks" in made ? { id: entry.id, title: entry.title, kind: "video", origin: "", doc: made } : { id: entry.id, title: entry.title, kind: "image", origin: "", artboard: made }, false];
    }),
  ];
  return new Map(all.map(([reference, original]) => [reference.id, complexityOf(reference, original)]));
}

if (mode === "report" || mode === "all") writeReport(OUT, GRADED, tiers(), TIER_RULE);

if (mode === "items") {
  const track = process.argv[3] ?? "brief";
  const wanted = new Set(process.argv.slice(4));
  const known = new Set((track === "brief" ? briefs() : references()).map((entry) => entry.id));
  console.log([...tiers()].filter(([id, tier]) => known.has(id) && wanted.has(tier.tier)).map(([id]) => `${track}:${id}`).join(","));
}
