import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DEFECT_KINDS, NOTE_KINDS, perceptionCorpus, type DefectKind, type PerceptionCase } from "./corpus";
import { guideCrossings } from "./guide-crossings";
import { VIDEO_DEFECT_KINDS, VIDEO_NOTE_KINDS, videoCorpus, type VideoCase, type VideoDefectKind } from "./video-corpus";

export interface Detection {
  kind: string;
  ids: string[];
}

export interface Rendered {
  id: string;
  legibility: string[];
  checks: string[];
  guides: { notes: string[] };
  channels: {
    outline: unknown;
    depth: Record<string, unknown>;
    layout: Record<string, unknown>;
    ascii: string;
    structured: { depth: Detection[]; layout: Detection[] };
  };
}

const CHECK_KINDS: [RegExp, DefectKind][] = [
  [/escondido atrás/, "hidden_layer"],
  [/se sobrepõem|atravessa o texto/, "overlap"],
  [/quase alinhad|quase no centro/, "misalign"],
  [/encosta na borda|sai da arte/, "crowded_margin"],
  [/contraste baixo|sem caixa, contorno ou sombra/, "text_legibility"],
  [/sombra pesada/, "shadow_heavy"],
  [/não aparece sobre o fundo escuro/, "shadow_invisible"],
];

function idsIn(line: string, item: PerceptionCase): string[] {
  return item.artboard.layers.map((layer) => layer.id).filter((id) => new RegExp(`(^|[^a-z0-9_])${id}([^a-z0-9_]|$)`).test(line));
}

export function beforeDetections(item: PerceptionCase, rendered: Rendered): Record<string, Detection[]> {
  const checks = rendered.checks.flatMap((line) => CHECK_KINDS.filter(([pattern]) => pattern.test(line)).map(([, kind]) => ({ kind, ids: idsIn(line, item) })));
  const legibility = rendered.legibility.filter((line) => !line.startsWith("ok")).map((line) => ({ kind: "text_legibility", ids: idsIn(line, item) }));
  const guides = rendered.guides.notes.map((line) => ({ kind: "near_parallel", ids: idsIn(line, item) }));
  return { checks, legibility, guides };
}

export function parseDetections(text: string, ids: readonly string[]): Detection[] {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as { defects?: { kind?: string; ids?: unknown[] }[] };
    const known = new Set(ids);
    return (parsed.defects ?? []).map((d) => ({ kind: String(d.kind ?? "other"), ids: (d.ids ?? []).map(String).filter((id) => known.has(id)) }));
  } catch {
    return [];
  }
}

export function matches(item: PerceptionCase, found: readonly Detection[]): boolean {
  const defect = item.defect;
  if (!defect) return false;
  const accepted = new Set([...defect.ids, ...defect.related]);
  return found.some((d) => d.kind === defect.kind && d.ids.some((id) => defect.ids.includes(id) || (defect.related.length > 0 && accepted.has(id) && d.ids.some((other) => defect.ids.includes(other)))) );
}

export function falseAlarms(item: PerceptionCase, found: readonly Detection[]): Detection[] {
  const allowed = new Set<string>([...(item.defect ? [item.defect.kind, ...item.defect.also] : [])]);
  return found.filter((d) => (DEFECT_KINDS as readonly string[]).includes(d.kind) && !allowed.has(d.kind));
}

function noteLines(cases: readonly { item: PerceptionCase; layout: readonly Detection[] }[]): string[] {
  return NOTE_KINDS.map((kind) => {
    const noted = cases.filter(({ layout }) => layout.some((d) => d.kind === kind)).map(({ item }) => item.id);
    const expected = cases.filter(({ item }) => item.expects.includes(kind)).map(({ item }) => item.id);
    const hits = expected.filter((id) => noted.includes(id));
    const elsewhere = noted.filter((id) => !expected.includes(id));
    return `nota informativa ${kind} (não conta como alarme): esperada em ${hits.length}/${expected.length}${expected.length > hits.length ? ` (faltou em ${expected.filter((id) => !hits.includes(id)).join(", ")})` : ""}; também em ${elsewhere.length > 0 ? elsewhere.join(", ") : "nenhuma outra arte"}`;
  });
}

function pct(n: number, d: number): string {
  return d === 0 ? "n/d" : `${Math.round((100 * n) / d)}%`;
}

function main(): void {
  const out =process.env.ELO_PERCEPTION_OUT ?? join(import.meta.dir, ".out");
  const rendered: Rendered[] = JSON.parse(readFileSync(join(out, "rendered.json"), "utf8"));
  const corpus = perceptionCorpus();
  const channelNames = ["checks", "legibility", "guides", "before", "depth", "layout", "after"] as const;
  const perCase = corpus.map((item) => {
    const r = rendered.find((x) => x.id === item.id)!;
    const before = beforeDetections(item, r);
    const all = [...before.checks, ...before.legibility, ...before.guides];
    const fresh = [...r.channels.structured.depth, ...r.channels.structured.layout];
    const sets: Record<(typeof channelNames)[number], Detection[]> = { ...before, before: all, depth: r.channels.structured.depth, layout: r.channels.structured.layout, after: [...all, ...fresh] } as Record<(typeof channelNames)[number], Detection[]>;
    return { item, sets };
  });
  const rows = DEFECT_KINDS.map((kind) => {
    const seeded = perCase.filter(({ item }) => item.defect?.kind === kind);
    const cells = channelNames.map((name) => {
      const hits = seeded.filter(({ item, sets }) => matches(item, sets[name])).length;
      const alarms = perCase.reduce((sum, { item, sets }) => sum + falseAlarms(item, sets[name]).filter((d) => d.kind === kind).length, 0);
      return { name, hits, total: seeded.length, alarms };
    });
    return { kind, cells };
  });
  const header = `| defeito (casos) | ${channelNames.join(" | ")} |`;
  const lines = [header, `|${"---|".repeat(channelNames.length + 1)}`];
  for (const row of rows) lines.push(`| ${row.kind} (${row.cells[0].total}) | ${row.cells.map((c) => `${c.hits}/${c.total}${c.alarms ? ` +${c.alarms}fp` : ""}`).join(" | ")} |`);
  const totals = channelNames.map((name) => {
    const seeded = perCase.filter(({ item }) => item.defect);
    const hits = seeded.filter(({ item, sets }) => matches(item, sets[name])).length;
    const alarms = perCase.reduce((sum, { item, sets }) => sum + falseAlarms(item, sets[name]).length, 0);
    const found = perCase.reduce((sum, { sets }) => sum + sets[name].filter((d) => (DEFECT_KINDS as readonly string[]).includes(d.kind)).length, 0);
    return { name, hits, total: seeded.length, alarms, found, recall: pct(hits, seeded.length), precision: pct(found - alarms, found) };
  });
  lines.push(`| total recall | ${totals.map((t) => `${t.hits}/${t.total} (${t.recall})`).join(" | ")} |`);
  lines.push(`| precisão (achados fora do defeito semeado) | ${totals.map((t) => `${t.precision} (${t.alarms} fp de ${t.found})`).join(" | ")} |`);
  const clean = perCase.filter(({ item }) => !item.defect);
  lines.push(`| alarmes nas ${clean.length} artes limpas | ${channelNames.map((name) => clean.reduce((sum, { item, sets }) => sum + falseAlarms(item, sets[name]).length, 0)).join(" | ")} |`);
  const crossings = corpus.map((item) => ({ id: item.id, count: guideCrossings(item.artboard) })).filter((entry) => entry.count > 0);
  lines.push("", `linhas de referência do alinhamento que cruzam elementos alheios: ${crossings.reduce((sum, entry) => sum + entry.count, 0)}${crossings.length ? ` (${crossings.map((entry) => `${entry.id} ${entry.count}`).join(", ")})` : ""}`);
  lines.push(...noteLines(perCase.map(({ item, sets }) => ({ item, layout: sets.layout }))));
  const table = lines.join("\n");
  console.log(table);
  const alarms = perCase.flatMap(({ item, sets }) => falseAlarms(item, [...sets.depth, ...sets.layout]).map((d) => `${item.id}: ${d.kind} ${d.ids.join(",")}`));
  if (alarms.length) console.log(`\nachados novos fora do defeito semeado:\n${alarms.join("\n")}`);
  const missed = perCase.filter(({ item, sets }) => item.defect && !matches(item, sets.after)).map(({ item }) => item.id);
  if (missed.length) console.log(`\nnão detectados por nenhum canal: ${missed.join(", ")}`);
  const videoTable = gradeVideos(out);
  console.log(`\n${videoTable}`);
  writeFileSync(join(out, "offline.md"), `${table}\n\n${videoTable}\n`);
}

const VIDEO_CHECK_KINDS: [RegExp, VideoDefectKind][] = [
  [/fica pouco tempo na tela/, "reading_time"],
  [/sai da arte/, "leaves_frame"],
  [/se sobrepõem/, "moving_overlap"],
];

interface RenderedVideo {
  id: string;
  checks: string[];
  structured: Detection[];
}

function gradeVideos(out: string): string {
  const rendered: RenderedVideo[] = JSON.parse(readFileSync(join(out, "rendered-video.json"), "utf8"));
  const cases = videoCorpus();
  const idsOf = (item: VideoCase, line: string) => item.doc.tracks.flatMap((t) => t.clips.map((c) => c.id)).filter((id) => line.includes(id));
  const sets = cases.map((item) => {
    const r = rendered.find((x) => x.id === item.id)!;
    const checks = r.checks.flatMap((line) => VIDEO_CHECK_KINDS.filter(([pattern]) => pattern.test(line)).map(([, kind]) => ({ kind, ids: idsOf(item, line) })));
    return { item, checks, motion: r.structured, after: [...checks, ...r.structured] };
  });
  const hit = (item: VideoCase, found: readonly Detection[]) => Boolean(item.defect && found.some((d) => d.kind === item.defect!.kind && d.ids.some((id) => item.defect!.ids.includes(id))));
  const alarms = (item: VideoCase, found: readonly Detection[]) => found.filter((d) => (VIDEO_DEFECT_KINDS as readonly string[]).includes(d.kind) && d.kind !== item.defect?.kind).length;
  const lines = ["| defeito de vídeo | checks (antes) | motion | depois |", "|---|---|---|---|"];
  for (const kind of VIDEO_DEFECT_KINDS) {
    const seeded = sets.filter(({ item }) => item.defect?.kind === kind);
    const cell = (key: "checks" | "motion" | "after") => `${seeded.filter((s) => hit(s.item, s[key])).length}/${seeded.length}${sets.reduce((sum, s) => sum + s[key].filter((d) => d.kind === kind && s.item.defect?.kind !== kind).length, 0) ? ` +${sets.reduce((sum, s) => sum + s[key].filter((d) => d.kind === kind && s.item.defect?.kind !== kind).length, 0)}fp` : ""}`;
    lines.push(`| ${kind} | ${cell("checks")} | ${cell("motion")} | ${cell("after")} |`);
  }
  const clean = sets.filter((s) => !s.item.defect && s.item.expects.length === 0);
  lines.push(`| alarmes nas ${clean.length} limpas | ${["checks", "motion", "after"].map((key) => clean.reduce((sum, s) => sum + alarms(s.item, s[key as "checks"]), 0)).join(" | ")} |`);
  const noteAlarms = sets.filter((s) => !s.item.defect && s.item.expects.length > 0).reduce((sum, s) => sum + alarms(s.item, s.after), 0);
  lines.push("", ...VIDEO_NOTE_KINDS.map((kind) => {
    const noted = sets.filter((s) => s.motion.some((d) => d.kind === kind)).map((s) => s.item.id);
    const expected = cases.filter((item) => item.expects.includes(kind)).map((item) => item.id);
    const hits = expected.filter((id) => noted.includes(id));
    const elsewhere = noted.filter((id) => !expected.includes(id));
    return `nota informativa ${kind} (não conta como alarme): esperada em ${hits.length}/${expected.length}; também em ${elsewhere.length > 0 ? elsewhere.join(", ") : "nenhum outro vídeo"}; alarmes nos casos de nota: ${noteAlarms}`;
  }));
  return lines.join("\n");
}

if (import.meta.main) main();
