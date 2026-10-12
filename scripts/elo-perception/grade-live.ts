import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DEFECT_KINDS, perceptionCorpus } from "./corpus";
import { ARMS, LOOP_PAIRS, VIDEO_ARMS } from "./export-cases";
import { falseAlarms, matches, parseDetections, type Detection } from "./grade";
import { VIDEO_DEFECT_KINDS, videoCorpus } from "./video-corpus";

interface LiveResult {
  case_id: string;
  arm: string;
  model: string;
  reasoning?: string;
  text: string;
  cost_usd: number;
}

const OUT = process.env.ELO_PERCEPTION_OUT ?? join(import.meta.dir, ".out");

function load(name: string): LiveResult[] {
  const path = join(OUT, name);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : [];
}

const who = (r: LiveResult) => (r.reasoning ? `${r.model}@${r.reasoning}` : r.model);
const HEADER = ["| modelo | braço | casos | recall | alarmes nas limpas | achados fora do semeado por caso | custo US$ |", "|---|---|---|---|---|---|---|"];

function imageSection(results: readonly LiveResult[]): string {
  const corpus = perceptionCorpus();
  const lines = [...HEADER];
  const kinds = [`| modelo | braço | ${DEFECT_KINDS.join(" | ")} |`, `|${"---|".repeat(DEFECT_KINDS.length + 2)}`];
  for (const name of [...new Set(results.map(who))]) {
    for (const arm of ARMS) {
      const graded = results.filter((r) => who(r) === name && r.arm === arm).map((r) => {
        const item = corpus.find((c) => c.id === r.case_id)!;
        return { item, found: parseDetections(r.text, item.artboard.layers.map((layer) => layer.id)), cost: r.cost_usd };
      });
      if (graded.length === 0) continue;
      const seeded = graded.filter(({ item }) => item.defect);
      const hits = seeded.filter(({ item, found }) => matches(item, found)).length;
      const clean = graded.filter(({ item }) => !item.defect).reduce((sum, { item, found }) => sum + falseAlarms(item, found).length, 0);
      const extra = graded.reduce((sum, { item, found }) => sum + falseAlarms(item, found).length, 0) / graded.length;
      lines.push(`| ${name} | ${arm} | ${graded.length} | ${hits}/${seeded.length} (${Math.round((100 * hits) / Math.max(1, seeded.length))}%) | ${clean} | ${extra.toFixed(2)} | ${graded.reduce((sum, g) => sum + g.cost, 0).toFixed(4)} |`);
      kinds.push(`| ${name} | ${arm} | ${DEFECT_KINDS.map((kind) => {
        const of = seeded.filter(({ item }) => item.defect?.kind === kind);
        return `${of.filter(({ item, found }) => matches(item, found)).length}/${of.length}`;
      }).join(" | ")} |`);
    }
  }
  return `${lines.join("\n")}\n\n${kinds.join("\n")}`;
}

function videoSection(results: readonly LiveResult[]): string {
  const cases = videoCorpus();
  const lines = [...HEADER];
  const kinds = [`| modelo | braço | ${VIDEO_DEFECT_KINDS.join(" | ")} |`, `|${"---|".repeat(VIDEO_DEFECT_KINDS.length + 2)}`];
  const hit = (item: (typeof cases)[number], found: readonly Detection[]) => Boolean(item.defect && found.some((d) => d.kind === item.defect!.kind && d.ids.some((id) => item.defect!.ids.includes(id))));
  const alarms = (item: (typeof cases)[number], found: readonly Detection[]) => found.filter((d) => (VIDEO_DEFECT_KINDS as readonly string[]).includes(d.kind) && d.kind !== item.defect?.kind).length;
  for (const name of [...new Set(results.map(who))]) {
    for (const arm of VIDEO_ARMS) {
      const graded = results.filter((r) => who(r) === name && r.arm === arm).map((r) => {
        const item = cases.find((c) => c.id === r.case_id)!;
        return { item, found: parseDetections(r.text, item.doc.tracks.flatMap((t) => t.clips.map((c) => c.id))), cost: r.cost_usd };
      });
      if (graded.length === 0) continue;
      const seeded = graded.filter(({ item }) => item.defect);
      const hits = seeded.filter(({ item, found }) => hit(item, found)).length;
      const clean = graded.filter(({ item }) => !item.defect).reduce((sum, { item, found }) => sum + alarms(item, found), 0);
      const extra = graded.reduce((sum, { item, found }) => sum + alarms(item, found), 0) / graded.length;
      lines.push(`| ${name} | ${arm} | ${graded.length} | ${hits}/${seeded.length} | ${clean} | ${extra.toFixed(2)} | ${graded.reduce((sum, g) => sum + g.cost, 0).toFixed(4)} |`);
      kinds.push(`| ${name} | ${arm} | ${VIDEO_DEFECT_KINDS.map((kind) => {
        const of = seeded.filter(({ item }) => item.defect?.kind === kind);
        return `${of.filter(({ item, found }) => hit(item, found)).length}/${of.length}`;
      }).join(" | ")} |`);
    }
  }
  return `${lines.join("\n")}\n\n${kinds.join("\n")}`;
}

function loopSection(results: readonly LiveResult[]): string {
  const corpus = perceptionCorpus();
  const lines = ["| modelo | braço | pares | novo defeito achado | defeito corrigido ainda apontado | custo US$ |", "|---|---|---|---|---|---|"];
  for (const name of [...new Set(results.map(who))]) {
    for (const arm of ["loop-plain", "loop-diff"]) {
      const graded = results.filter((r) => who(r) === name && r.arm === arm).map((r) => {
        const after = corpus.find((c) => c.id === r.case_id)!;
        const before = corpus.find((c) => c.id === LOOP_PAIRS.find(([, to]) => to === r.case_id)![0])!;
        const found = parseDetections(r.text, after.artboard.layers.map((layer) => layer.id));
        return { found: matches(after, found), stale: matches(before, found), cost: r.cost_usd };
      });
      if (graded.length === 0) continue;
      lines.push(`| ${name} | ${arm} | ${graded.length} | ${graded.filter((g) => g.found).length}/${graded.length} | ${graded.filter((g) => g.stale).length}/${graded.length} | ${graded.reduce((sum, g) => sum + g.cost, 0).toFixed(4)} |`);
    }
  }
  return lines.join("\n");
}

const image = [...load("perception-results.json"), ...load("perception-adaptive-results.json")];
const video = load("perception-video-results.json");
const loop = load("perception-loop-results.json");
const total = [...image, ...video, ...loop].reduce((sum, r) => sum + r.cost_usd, 0);
const carried = existsSync(join(OUT, "spent-before-backend.json")) ? (JSON.parse(readFileSync(join(OUT, "spent-before-backend.json"), "utf8")) as { carried_usd: number; recorded_usd: number }) : null;
const ledger = carried ? `\n\ncusto: US$ ${total.toFixed(4)} registrado por chamada; com a margem da fase anterior (US$ ${(carried.carried_usd - carried.recorded_usd).toFixed(2)}), US$ ${(total + carried.carried_usd - carried.recorded_usd).toFixed(4)}` : `\n\ncusto: US$ ${total.toFixed(4)}`;
const report = `## imagem\n\n${imageSection(image)}\n\n## vídeo\n\n${videoSection(video)}\n\n## laço de crítica\n\n${loopSection(loop)}${ledger}`;
console.log(report);
writeFileSync(join(OUT, "live.md"), `${report}\n`);
