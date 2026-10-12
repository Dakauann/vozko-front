import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { CREATIVITY, PAIR_CRITERIA, parsePair, parseVerdict, roundOf, RUBRIC, type GradedRun, type JudgeVerdict, type PairCriterion, type PairVerdict } from "./grading";
import type { StudioDocument } from "@/lib/studio/document";
import { richnessOf, varietyOf, type Richness } from "./richness";

export interface TierOf {
  tier: string;
  score: number;
}

const TIER_ORDER = ["sota", "complex", "intermediate", "simple"];
const TIER_LABELS: Record<string, string> = { sota: "topo", complex: "complexo", intermediate: "intermediário", simple: "simples" };

function tierRank(tier: string): number {
  const index = TIER_ORDER.indexOf(tier);
  return index < 0 ? TIER_ORDER.length : index;
}

interface JudgeRecord {
  case_id: string;
  arm?: string;
  model: string;
  text: string;
  cost_usd: number;
}

interface ReferenceRow {
  id: string;
  title: string;
  kind: string;
  origin: string;
  image: string;
  findings: { level: string }[];
}

interface Row {
  key: string;
  track: "replicate" | "brief";
  item: string;
  model: string;
  perception: string;
  round: string;
  tier: string;
  image: string | null;
  cost: number;
  calls: number;
  looks: number;
  edits: number;
  failedEdits: number;
  outcome: string;
  errors: number;
  warnings: number;
  checks: number;
  findings: string[];
  replication: GradedRun["replication"];
  verdict: JudgeVerdict | null;
  creativity: JudgeVerdict | null;
  richness: Richness | null;
  document: StudioDocument | null;
  versus: GradedRun["versus"];
  pairs: PairVerdict[];
  invalid: string | null;
  judgeModel: string;
  judgeCost: number;
}

const LABELS: Record<string, string> = { hierarchy: "Hierarquia", typography: "Tipografia", color: "Cor", depth: "Profundidade", composition: "Composição", fit: "Adequação", polish: "Acabamento", similarity: "Semelhança" };

function escape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function fixed(value: number | null, digits = 2): string {
  return value === null ? "n/d" : value.toFixed(digits);
}

export function rubricMean(verdict: JudgeVerdict | null): number | null {
  if (!verdict) return null;
  return mean(RUBRIC.flatMap((key) => (typeof verdict.scores[key] === "number" ? [verdict.scores[key]!] : [])));
}

interface InvalidRule {
  track: string;
  round: string;
  items: string[];
  reason: string;
}

function invalidOf(rules: readonly InvalidRule[], entry: GradedRun): string | null {
  return rules.find((rule) => rule.track === entry.run.track && rule.round === roundOf(entry.run) && rule.items.includes(entry.run.item))?.reason ?? null;
}

function rowsOf(graded: readonly GradedRun[], judged: readonly JudgeRecord[], creative: readonly JudgeRecord[], paired: readonly JudgeRecord[], rules: readonly InvalidRule[], tiers: ReadonlyMap<string, TierOf>): Row[] {
  const verdicts = new Map(judged.map((record) => [record.case_id, record]));
  const creativity = new Map(creative.map((record) => [record.case_id, record]));
  return graded.map((entry) => {
    const lines = [...(entry.inspection?.findings.map((f) => `${f.level}: ${f.text}`) ?? []), ...(entry.inspection?.checks ?? []), ...(entry.inspection?.legibility ?? [])];
    const record = verdicts.get(entry.key);
    return {
      key: entry.key,
      track: entry.run.track,
      item: entry.run.item,
      model: entry.run.model,
      perception: entry.run.perception,
      round: roundOf(entry.run),
      tier: tiers.get(entry.run.item)?.tier ?? "simple",
      image: entry.image,
      cost: entry.run.cost_usd,
      calls: entry.run.model_calls,
      looks: entry.run.looks,
      edits: entry.run.edits,
      failedEdits: entry.run.failed_edits,
      outcome: entry.run.outcome,
      errors: lines.filter((line) => line.startsWith("erro")).length,
      warnings: lines.filter((line) => line.startsWith("aviso")).length,
      checks: entry.inspection?.checks.length ?? 0,
      findings: lines,
      replication: entry.replication,
      verdict: record ? parseVerdict(record.text) : null,
      creativity: creativity.has(entry.key) ? parseVerdict(creativity.get(entry.key)!.text) : null,
      richness: entry.run.document ? richnessOf(entry.run.document) : null,
      document: entry.run.document,
      versus: entry.versus ?? null,
      pairs: paired.filter((p) => p.case_id === entry.key && p.arm).flatMap((p) => parsePair(p.text, p.arm!) ?? []),
      invalid: invalidOf(rules, entry),
      judgeModel: record?.model ?? "",
      judgeCost: record?.cost_usd ?? 0,
    };
  });
}

function short(model: string): string {
  return model.split("/").pop() ?? model;
}

function groupKey(row: Row): string {
  return `${row.model}|${row.perception}|${row.round}|${row.tier}`;
}

export function summaryRows(rows: readonly Row[]): { model: string; perception: string; round: string; tier: string; track: string; runs: number; rubric: number | null; similarity: number | null; block: number | null; text: number | null; textExact: number | null; position: number | null; color: number | null; ssim: number | null; errors: number | null; warnings: number | null; calls: number | null; cost: number }[] {
  const groups = new Map<string, Row[]>();
  for (const row of rows) groups.set(`${groupKey(row)}|${row.track}`, [...(groups.get(`${groupKey(row)}|${row.track}`) ?? []), row]);
  return [...groups.entries()].map(([key, members]) => {
    const [model, perception, round, tier, track] = key.split("|");
    const replicated = members.flatMap((m) => (m.replication ? [m.replication] : []));
    return {
      model,
      perception,
      round,
      tier,
      track,
      runs: members.length,
      rubric: mean(members.flatMap((m) => rubricMean(m.verdict) ?? [])),
      similarity: mean(members.flatMap((m) => (typeof m.verdict?.scores.similarity === "number" ? [m.verdict.scores.similarity] : []))),
      block: mean(replicated.map((r) => r.score.blockMatch)),
      text: mean(replicated.map((r) => r.score.text.similarity)),
      textExact: mean(replicated.map((r) => (r.score.text.total === 0 ? 1 : r.score.text.exact / r.score.text.total))),
      position: mean(replicated.map((r) => r.score.positionError)),
      color: mean(replicated.map((r) => r.score.colorError)),
      ssim: mean(replicated.map((r) => r.ssim)),
      errors: mean(members.map((m) => m.errors)),
      warnings: mean(members.map((m) => m.warnings)),
      calls: mean(members.map((m) => m.calls)),
      cost: members.reduce((sum, m) => sum + m.cost, 0),
    };
  });
}

function markdown(rows: readonly Row[], judgeCost: number): string {
  const summary = summaryRows(rows);
  const head = "| nível | modelo | percepção | rodada | trilha | execuções | rubrica (1 a 5) | semelhança (1 a 5) | blocos | texto | texto exato | erro de posição | ΔE00 cor | SSIM | erros | avisos | chamadas | custo US$ |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|";
  const lines = summary.map((s) => `| ${s.tier} | ${short(s.model)} | ${s.perception} | ${s.round} | ${s.track} | ${s.runs} | ${fixed(s.rubric)} | ${fixed(s.similarity)} | ${fixed(s.block)} | ${fixed(s.text)} | ${fixed(s.textExact)} | ${fixed(s.position, 3)} | ${fixed(s.color, 1)} | ${fixed(s.ssim)} | ${fixed(s.errors, 1)} | ${fixed(s.warnings, 1)} | ${fixed(s.calls, 1)} | ${s.cost.toFixed(4)} |`);
  const perRun = rows.map((r) => `| ${r.tier} | ${r.track} | ${r.item} | ${short(r.model)} | ${r.perception} | ${r.round} | ${fixed(rubricMean(r.verdict))} | ${typeof r.verdict?.scores.similarity === "number" ? r.verdict.scores.similarity : "n/d"} | ${r.replication ? r.replication.score.blockMatch.toFixed(2) : "n/d"} | ${r.replication ? `${r.replication.score.text.exact}/${r.replication.score.text.total}` : "n/d"} | ${r.replication ? r.replication.ssim.toFixed(2) : "n/d"} | ${r.errors} | ${r.warnings} | ${r.calls} | ${r.looks} | ${r.failedEdits}/${r.edits} | ${r.cost.toFixed(4)} | ${escape(r.verdict?.worst ?? r.outcome).replace(/\|/g, "/")} |`);
  const total = rows.reduce((sum, r) => sum + r.cost, 0);
  return [
    head,
    ...lines,
    "",
    "| nível | trilha | item | modelo | percepção | rodada | rubrica | semelhança | blocos | texto exato | SSIM | erros | avisos | chamadas | olhadas | edições recusadas | custo US$ | pior problema (juiz) |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...perRun,
    "",
    `Designer runs US$ ${total.toFixed(4)}; judge US$ ${judgeCost.toFixed(4)}; total US$ ${(total + judgeCost).toFixed(4)}.`,
    "",
    creativityMarkdown(rows),
  ].join("\n");
}

const RICHNESS_KEYS: (keyof Richness)[] = ["elements", "shapeKinds", "curved", "effects", "depthPlanes", "photos", "typeLevels", "fonts", "palette"];
const RICHNESS_LABELS: Record<keyof Richness, string> = { elements: "elementos", shapeKinds: "tipos de forma", curved: "curvas", effects: "com efeito", depthPlanes: "planos de sombra", photos: "fotos", typeLevels: "níveis de tipo", fonts: "fontes", palette: "cores" };

export function creativityGroups(rows: readonly Row[]) {
  const groups = new Map<string, Row[]>();
  for (const row of rows.filter((r) => r.track === "brief" && r.document && !r.invalid)) groups.set(groupKey(row), [...(groups.get(groupKey(row)) ?? []), row]);
  return [...groups.entries()].map(([key, members]) => {
    const [model, perception, round, tier] = key.split("|");
    const judged = (k: string) => mean(members.flatMap((m) => (typeof m.creativity?.scores[k as keyof JudgeVerdict["scores"]] === "number" ? [m.creativity!.scores[k as keyof JudgeVerdict["scores"]]!] : [])));
    const metric = (k: keyof Richness) => mean(members.flatMap((m) => (m.richness ? [m.richness[k]] : [])));
    return { model, perception, round, tier, runs: members.length, creativity: Object.fromEntries(CREATIVITY.map((k) => [k, judged(k)])), richness: Object.fromEntries(RICHNESS_KEYS.map((k) => [k, metric(k)])), variety: varietyOf(members.map((m) => m.document!)) };
  });
}

function creativityMarkdown(rows: readonly Row[]): string {
  const groups = creativityGroups(rows);
  const head = `| nível | modelo | percepção | rodada | briefs | originalidade | riqueza (juiz) | forma | ${RICHNESS_KEYS.map((k) => RICHNESS_LABELS[k]).join(" | ")} | distância de layout | distância de paleta | fonte mais repetida | convergência |`;
  const rule = `|${"---|".repeat(5 + 3 + RICHNESS_KEYS.length + 4)}`;
  const lines = groups.map((g) => `| ${g.tier} | ${short(g.model)} | ${g.perception} | ${g.round} | ${g.runs} | ${CREATIVITY.map((k) => fixed(g.creativity[k])).join(" | ")} | ${RICHNESS_KEYS.map((k) => fixed(g.richness[k], 1)).join(" | ")} | ${g.variety.layoutDistance.toFixed(2)} | ${g.variety.paletteDistance.toFixed(1)} | ${g.variety.fontRepetition.font} ${Math.round(g.variety.fontRepetition.share * 100)}% | ${g.variety.converging.join("; ") || "nenhuma"} |`);
  return [head, rule, ...lines].join("\n");
}

function chip(label: string, value: string, tone: "plain" | "good" | "warn" | "bad" = "plain"): string {
  return `<span class="chip ${tone}"><span class="k">${escape(label)}</span><span class="v">${escape(value)}</span></span>`;
}

function scoreTone(value: number | null): "plain" | "good" | "warn" | "bad" {
  if (value === null) return "plain";
  return value >= 4 ? "good" : value >= 3 ? "warn" : "bad";
}

function rubricBars(verdict: JudgeVerdict | null, withSimilarity: boolean): string {
  if (!verdict) return `<p class="muted">Sem nota do juiz.</p>`;
  const keys = [...(withSimilarity ? ["similarity"] : []), ...RUBRIC];
  const bars = keys
    .map((key) => {
      const value = verdict.scores[key as keyof JudgeVerdict["scores"]];
      const reason = verdict.reasons[key as keyof JudgeVerdict["reasons"]] ?? "";
      const width = typeof value === "number" ? (value / 5) * 100 : 0;
      return `<li title="${escape(reason)}"><span class="bl">${LABELS[key]}</span><span class="track"><span class="fill ${scoreTone(typeof value === "number" ? value : null)}" style="width:${width}%"></span></span><span class="bv">${typeof value === "number" ? value : "n/d"}</span></li>`;
    })
    .join("");
  return `<ul class="bars">${bars}</ul>${verdict.worst ? `<p class="worst"><strong>Pior problema:</strong> ${escape(verdict.worst)}</p>` : ""}<details class="reasons"><summary>Motivos do juiz</summary><dl>${keys.map((key) => `<dt>${LABELS[key]}</dt><dd>${escape(verdict.reasons[key as keyof JudgeVerdict["reasons"]] ?? "n/d")}</dd>`).join("")}</dl></details>`;
}

const CREATIVITY_LABELS: Record<string, string> = { originality: "Originalidade", richness: "Riqueza de detalhes", form: "Forma e expressão" };

function creativityBars(verdict: JudgeVerdict): string {
  const bars = CREATIVITY.map((key) => {
    const value = verdict.scores[key];
    const width = typeof value === "number" ? (value / 5) * 100 : 0;
    return `<li title="${escape(verdict.reasons[key] ?? "")}"><span class="bl">${CREATIVITY_LABELS[key]}</span><span class="track"><span class="fill ${scoreTone(typeof value === "number" ? value : null)}" style="width:${width}%"></span></span><span class="bv">${typeof value === "number" ? value : "n/d"}</span></li>`;
  }).join("");
  return `<ul class="bars creative">${bars}</ul>`;
}

function attempt(row: Row): string {
  const metrics = row.replication
    ? [chip("blocos", row.replication.score.blockMatch.toFixed(2)), chip("texto exato", `${row.replication.score.text.exact}/${row.replication.score.text.total}`), chip("posição", `${(row.replication.score.positionError * 100).toFixed(1)}%`), chip("tamanho", `${(row.replication.score.sizeError * 100).toFixed(1)}%`), chip("ΔE00", row.replication.score.colorError.toFixed(1)), chip("SSIM", row.replication.ssim.toFixed(2))].join("")
    : "";
  const rubric = rubricMean(row.verdict);
  const defects = row.findings.length > 0 ? `<details class="defects"><summary>${row.errors} erros, ${row.warnings} avisos medidos</summary><ul>${row.findings.map((line) => `<li class="${line.startsWith("erro") ? "e" : "w"}">${escape(line)}</li>`).join("")}</ul></details>` : `<p class="muted">Nenhum defeito medido.</p>`;
  return `<article class="attempt" data-model="${escape(row.model)}" data-perception="${escape(row.perception)}" data-round="${escape(row.round)}">
<header><span class="model">${escape(short(row.model))}</span><span class="arm ${row.perception}">rodada ${escape(row.round)} · percepção ${row.perception === "on" ? "ligada" : "desligada"}</span></header>
${row.invalid ? `<p class="outcome">Inválido: ${escape(row.invalid)}</p>` : ""}
${row.invalid ? "" : row.image ? `<img loading="lazy" src="img/${escape(row.image)}" alt="Resultado de ${escape(short(row.model))}">` : `<div class="empty">Sem documento: ${escape(row.outcome)}</div>`}
${row.versus ? `<figure class="versus"><img loading="lazy" src="img/${escape(row.versus.eloLeft)}" alt="Elo à esquerda, design real à direita"><figcaption>Elo à esquerda, design real à direita${row.pairs.length > 0 ? ": " + PAIR_CRITERIA.map((k) => { const t = tally(row.pairs, k); return `${PAIR_LABELS[k].toLowerCase()} Elo ${t.elo}, empate ${t.tie}, real ${t.real}`; }).join("; ") : ""}</figcaption></figure>` : ""}
<div class="chips">${chip("rubrica", rubric === null ? "n/d" : rubric.toFixed(1), scoreTone(rubric))}${metrics}${chip("chamadas", String(row.calls))}${chip("olhadas", String(row.looks))}${chip("lotes recusados", `${row.failedEdits}/${row.edits}`, row.failedEdits > 0 ? "warn" : "plain")}${chip("US$", row.cost.toFixed(3))}</div>
${rubricBars(row.verdict, row.track === "replicate")}
${row.creativity ? creativityBars(row.creativity) : ""}
${row.richness ? `<div class="chips">${RICHNESS_KEYS.map((k) => chip(RICHNESS_LABELS[k], String(row.richness![k]))).join("")}</div>` : ""}
${defects}
${row.outcome !== "done" ? `<p class="outcome">Fim da execução: ${escape(row.outcome)}</p>` : ""}
</article>`;
}

function section(title: string, id: string, intro: string, items: { id: string; title: string; lead: string; rows: Row[]; tier: string; score: number }[]): string {
  return `<section id="${id}"><h2>${escape(title)}</h2><p class="intro">${intro}</p>${items
    .map(
      (item) => `<div class="item" data-tier="${escape(item.tier)}"><div class="item-head"><h3>${escape(item.title)}</h3><span class="tier ${escape(item.tier)}">${escape(TIER_LABELS[item.tier] ?? item.tier)} · ${item.score}</span><span class="slug">${escape(item.id)}</span></div><div class="row">${item.lead}${item.rows.map(attempt).join("")}</div></div>`,
    )
    .join("")}</section>`;
}

const PAIR_LABELS: Record<PairCriterion, string> = { client: "Cliente escolheria", appeal: "Mais atraente", original: "Mais original", professional: "Mais profissional", purpose: "Cumpre melhor o objetivo" };

function tally(pairs: readonly PairVerdict[], key: PairCriterion): { elo: number; real: number; tie: number; rate: number | null } {
  const votes = pairs.flatMap((p) => (p.choices[key] ? [p.choices[key]!] : []));
  const elo = votes.filter((v) => v === "elo").length;
  const real = votes.filter((v) => v === "real").length;
  const tie = votes.filter((v) => v === "tie").length;
  return { elo, real, tie, rate: votes.length === 0 ? null : (elo + tie / 2) / votes.length };
}

export function pairGroups(rows: readonly Row[]) {
  const groups = new Map<string, Row[]>();
  for (const row of rows.filter((r) => r.track === "brief" && r.pairs.length > 0 && !r.invalid)) groups.set(groupKey(row), [...(groups.get(groupKey(row)) ?? []), row]);
  return [...groups.entries()].map(([key, members]) => {
    const [model, perception, round, tier] = key.split("|");
    const pairs = members.flatMap((m) => m.pairs);
    return { model, perception, round, tier, briefs: members.length, verdicts: pairs.length, tallies: Object.fromEntries(PAIR_CRITERIA.map((k) => [k, tally(pairs, k)])) as Record<PairCriterion, ReturnType<typeof tally>> };
  });
}

function percent(value: number | null): string {
  return value === null ? "n/d" : `${Math.round(value * 100)}%`;
}

function pairTable(rows: readonly Row[]): string {
  const groups = pairGroups(rows);
  if (groups.length === 0) return `<p class="muted">Ainda sem veredito pareado: rode o juiz pareado (pairwise-inputs).</p>`;
  return `<div class="table-wrap"><table><thead><tr><th>Nível</th><th>Modelo</th><th>Rodada</th><th>Briefs</th><th>Vereditos</th>${PAIR_CRITERIA.map((k) => `<th>${PAIR_LABELS[k]}</th>`).join("")}</tr></thead><tbody>${groups
    .map((g) => `<tr><td>${escape(TIER_LABELS[g.tier] ?? g.tier)}</td><td>${escape(short(g.model))}</td><td>${escape(g.round)}</td><td>${g.briefs}</td><td>${g.verdicts}</td>${PAIR_CRITERIA.map((k) => `<td>${percent(g.tallies[k].rate)} <span class="muted">(${g.tallies[k].elo}/${g.tallies[k].tie}/${g.tallies[k].real})</span></td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

function pairMarkdown(rows: readonly Row[]): string {
  const groups = pairGroups(rows);
  const head = `| nível | modelo | rodada | briefs | vereditos | ${PAIR_CRITERIA.map((k) => `${PAIR_LABELS[k]} (Elo/empate/real)`).join(" | ")} |`;
  const rule = `|${"---|".repeat(5 + PAIR_CRITERIA.length)}`;
  return [head, rule, ...groups.map((g) => `| ${g.tier} | ${short(g.model)} | ${g.round} | ${g.briefs} | ${g.verdicts} | ${PAIR_CRITERIA.map((k) => `${percent(g.tallies[k].rate)} (${g.tallies[k].elo}/${g.tallies[k].tie}/${g.tallies[k].real})`).join(" | ")} |`)].join("\n");
}

function creativityTable(rows: readonly Row[]): string {
  const groups = creativityGroups(rows);
  return `<div class="table-wrap"><table><thead><tr><th>Nível</th><th>Modelo</th><th>Percepção</th><th>Rodada</th><th>Briefs</th><th>Originalidade</th><th>Riqueza</th><th>Forma</th>${RICHNESS_KEYS.map((k) => `<th>${RICHNESS_LABELS[k]}</th>`).join("")}<th>Layout</th><th>Paleta</th><th>Fonte repetida</th><th>Convergência</th></tr></thead><tbody>${groups
    .map((g) => `<tr><td>${escape(TIER_LABELS[g.tier] ?? g.tier)}</td><td>${escape(short(g.model))}</td><td>${g.perception === "on" ? "ligada" : "desligada"}</td><td>${escape(g.round)}</td><td>${g.runs}</td>${CREATIVITY.map((k) => `<td>${fixed(g.creativity[k])}</td>`).join("")}${RICHNESS_KEYS.map((k) => `<td>${fixed(g.richness[k], 1)}</td>`).join("")}<td>${g.variety.layoutDistance.toFixed(2)}</td><td>${g.variety.paletteDistance.toFixed(1)}</td><td>${escape(g.variety.fontRepetition.font)} ${Math.round(g.variety.fontRepetition.share * 100)}%</td><td class="wrap">${escape(g.variety.converging.join("; ") || "nenhuma")}</td></tr>`)
    .join("")}</tbody></table></div>`;
}

function html(rows: readonly Row[], references: readonly ReferenceRow[], briefs: readonly { id: string; title: string; text: string }[], judgeCost: number, judgeModel: string, notes: readonly string[], tiers: ReadonlyMap<string, TierOf>, rule: string): string {
  const summary = summaryRows(rows.filter((r) => !r.invalid));
  const total = rows.reduce((sum, r) => sum + r.cost, 0) + judgeCost;
  const models = [...new Set(rows.map((r) => r.model))];
  const rounds = [...new Set(rows.map((r) => r.round))].sort();
  const ordered = <T extends { id: string }>(list: readonly T[]) => [...list].sort((a, b) => tierRank(tiers.get(a.id)?.tier ?? "simple") - tierRank(tiers.get(b.id)?.tier ?? "simple") || (tiers.get(b.id)?.score ?? 0) - (tiers.get(a.id)?.score ?? 0));
  const replicate = ordered(references).map((ref) => ({
    id: ref.id,
    title: ref.title,
    tier: tiers.get(ref.id)?.tier ?? "simple",
    score: tiers.get(ref.id)?.score ?? 0,
    lead: `<article class="attempt reference"><header><span class="model">Referência</span><span class="arm ref">verdade de camada</span></header><img loading="lazy" src="img/${escape(ref.image)}" alt="Referência ${escape(ref.title)}"><p class="origin">${escape(ref.origin)}</p></article>`,
    rows: rows.filter((r) => r.track === "replicate" && r.item === ref.id),
  }));
  const open = ordered(briefs).map((brief) => ({ id: brief.id, title: brief.title, tier: tiers.get(brief.id)?.tier ?? "simple", score: tiers.get(brief.id)?.score ?? 0, lead: `<article class="attempt brief"><header><span class="model">Brief</span></header><p class="brief-text">${escape(brief.text)}</p></article>`, rows: rows.filter((r) => r.track === "brief" && r.item === brief.id) }));
  const table = `<div class="table-wrap"><table><thead><tr><th>Nível</th><th>Modelo</th><th>Percepção</th><th>Rodada</th><th>Trilha</th><th>Execuções</th><th>Rubrica</th><th>Semelhança</th><th>Blocos</th><th>Texto exato</th><th>SSIM</th><th>Erros</th><th>Avisos</th><th>Chamadas</th><th>US$</th></tr></thead><tbody>${summary
    .map((s) => `<tr><td>${escape(TIER_LABELS[s.tier] ?? s.tier)}</td><td>${escape(short(s.model))}</td><td>${s.perception === "on" ? "ligada" : "desligada"}</td><td>${escape(s.round)}</td><td>${s.track === "replicate" ? "Réplica" : "Brief"}</td><td>${s.runs}</td><td>${fixed(s.rubric)}</td><td>${fixed(s.similarity)}</td><td>${fixed(s.block)}</td><td>${fixed(s.textExact)}</td><td>${fixed(s.ssim)}</td><td>${fixed(s.errors, 1)}</td><td>${fixed(s.warnings, 1)}</td><td>${fixed(s.calls, 1)}</td><td>${s.cost.toFixed(3)}</td></tr>`)
    .join("")}</tbody></table></div>`;
  const filters = `<div class="filters" role="group" aria-label="Filtros">${TIER_ORDER.map((tier) => `<label class="toggle"><input type="checkbox" id="tier-${tier}" data-filter="tier" value="${tier}" checked> ${TIER_LABELS[tier]}</label>`).join("")}${models.map((m, i) => `<label class="toggle"><input type="checkbox" id="model-${i}" data-filter="model" value="${escape(m)}" checked> ${escape(short(m))}</label>`).join("")}<label class="toggle"><input type="checkbox" id="arm-on" data-filter="perception" value="on" checked> percepção ligada</label><label class="toggle"><input type="checkbox" id="arm-off" data-filter="perception" value="off" checked> percepção desligada</label>${rounds.map((round) => `<label class="toggle"><input type="checkbox" id="round-${escape(round)}" data-filter="round" value="${escape(round)}" checked> rodada ${escape(round)}</label>`).join("")}</div>`;
  return `<title>Elo Design Benchmark</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&family=IBM+Plex+Mono:wght@400;600&display=swap">
<style>
:root {
  --paper: #f5f4f6; --sheet: #ffffff; --ink: #1d1a22; --muted: #6a6473; --rule: #dedae3;
  --accent: #b0125b; --good: #1f7a4d; --warn: #a15c00; --bad: #b42318; --chip: #efedf2;
  --display: "Archivo", "Helvetica Neue", Arial, sans-serif; --mono: "IBM Plex Mono", ui-monospace, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --paper: #141218; --sheet: #1d1a22; --ink: #ece9f0; --muted: #a39dab; --rule: #34303b; --accent: #ff5fa2; --good: #5fd39a; --warn: #f0b04f; --bad: #ff7a6b; --chip: #2a2630; color-scheme: dark } }
:root[data-theme="dark"] { --paper: #141218; --sheet: #1d1a22; --ink: #ece9f0; --muted: #a39dab; --rule: #34303b; --accent: #ff5fa2; --good: #5fd39a; --warn: #f0b04f; --bad: #ff7a6b; --chip: #2a2630; color-scheme: dark }
body { background: var(--paper); color: var(--ink); font-family: var(--display); font-size: 15px; line-height: 1.5; }
.wrap { max-width: 1500px; margin: 0 auto; padding-inline: 16px; padding-block: 32px 64px; display: grid; gap: 40px; }
h1 { font-size: clamp(28px, 4vw, 44px); font-weight: 800; letter-spacing: -0.02em; margin: 0; text-wrap: balance; }
h2 { font-size: 24px; font-weight: 800; margin: 0 0 6px; }
h3 { font-size: 17px; font-weight: 600; margin: 0; }
.lede { max-width: 70ch; color: var(--muted); margin: 8px 0 0; }
.facts { display: flex; flex-wrap: wrap; gap: 8px 24px; font-family: var(--mono); font-size: 13px; margin-top: 16px; }
.facts b { color: var(--accent); font-weight: 600; }
.table-wrap { overflow-x: auto; background: var(--sheet); border: 1px solid var(--rule); }
table { border-collapse: collapse; width: 100%; font-size: 13px; font-variant-numeric: tabular-nums; }
td.wrap { white-space: normal; min-width: 260px; }
th, td { padding: 8px 10px; border-bottom: 1px solid var(--rule); text-align: left; white-space: nowrap; }
th { font-weight: 600; color: var(--muted); text-transform: uppercase; font-size: 11px; letter-spacing: 0.06em; }
.filters { display: flex; flex-wrap: wrap; gap: 8px; position: sticky; top: env(safe-area-inset-top, 0px); background: var(--paper); padding-block: 10px; z-index: 2; border-bottom: 1px solid var(--rule); }
.toggle { display: inline-flex; gap: 6px; align-items: center; font-size: 13px; padding: 4px 10px; border: 1px solid var(--rule); border-radius: 999px; background: var(--sheet); cursor: pointer; }
.toggle input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.intro { color: var(--muted); max-width: 75ch; margin: 0 0 16px; }
.tier { font-family: var(--mono); font-size: 11px; padding: 2px 6px; background: var(--chip); color: var(--muted); }
.tier.complex { color: var(--accent); }
.item { padding-block: 18px; border-top: 1px solid var(--rule); display: grid; gap: 12px; }
.item-head { display: flex; gap: 12px; align-items: baseline; }
.slug { font-family: var(--mono); font-size: 12px; color: var(--muted); }
.row { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; align-items: start; }
.attempt { background: var(--sheet); border: 1px solid var(--rule); padding: 12px; display: grid; gap: 10px; min-width: 0; }
.attempt.reference { border-color: var(--accent); }
.attempt header { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
.model { font-weight: 600; }
.arm { font-family: var(--mono); font-size: 11px; color: var(--muted); }
.arm.on { color: var(--accent); }
.attempt img { width: 100%; height: auto; display: block; background: var(--chip); }
.empty { aspect-ratio: 4 / 5; display: grid; place-items: center; text-align: center; color: var(--muted); background: var(--chip); padding: 12px; font-size: 13px; max-width: 100%; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { display: inline-flex; gap: 4px; font-family: var(--mono); font-size: 11px; background: var(--chip); padding: 2px 6px; font-variant-numeric: tabular-nums; }
.chip .k { color: var(--muted); }
.chip.good .v { color: var(--good); } .chip.warn .v { color: var(--warn); } .chip.bad .v { color: var(--bad); }
.bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; font-size: 12px; }
.bars li { display: grid; grid-template-columns: 92px 1fr 22px; gap: 6px; align-items: center; }
.track { height: 6px; background: var(--chip); }
.fill { display: block; height: 100%; background: var(--muted); }
.fill.good { background: var(--good); } .fill.warn { background: var(--warn); } .fill.bad { background: var(--bad); }
.bv { font-family: var(--mono); text-align: right; }
.worst { font-size: 13px; margin: 0; }
details summary { cursor: pointer; font-size: 12px; color: var(--muted); }
details ul, details dl { font-size: 12px; margin: 6px 0 0; padding-left: 16px; }
details dt { font-weight: 600; margin-top: 4px; }
details dd { margin: 0; color: var(--muted); }
li.e { color: var(--bad); } li.w { color: var(--warn); }
.muted, .origin { color: var(--muted); font-size: 12px; margin: 0; }
.outcome { font-size: 12px; color: var(--warn); margin: 0; }
.brief-text { margin: 0; font-size: 14px; }
.hidden-by-filter { display: none; }
.versus { margin: 0; display: grid; gap: 4px; }
.versus figcaption { font-size: 12px; color: var(--muted); }
.notes { max-width: 75ch; margin: 16px 0 0; padding-left: 18px; font-size: 14px; display: grid; gap: 6px; }
</style>
<div class="wrap">
<header>
<h1>Elo Design Benchmark</h1>
<p class="lede">Cada linha é uma peça. Na trilha de réplica, a referência foi desenhada no formato real do Estúdio e renderizada pelo renderizador real; a Elo recebeu só a imagem, o tamanho e as fontes. Na trilha de brief, recebeu só o texto. Todas as imagens abaixo saíram do mesmo renderizador headless.</p>
<p class="lede">Níveis de complexidade: ${escape(rule)}.</p>
<div class="facts"><span>custo total <b>US$ ${total.toFixed(2)}</b></span><span>juiz <b>${escape(short(judgeModel))}</b></span><span>execuções <b>${rows.length}</b></span></div>
${notes.length > 0 ? `<ul class="notes">${notes.map((note) => `<li>${escape(note)}</li>`).join("")}</ul>` : ""}
</header>
<section><h2>Elo contra o design real</h2><p class="intro">Juiz cego e pareado: para cada brief, o juiz vê duas peças sem rótulo, a da Elo e a reconstrução do design real, nas duas ordens. A taxa conta vitória da Elo como 1 e empate como meio; entre parênteses, vitórias da Elo, empates e vitórias do design real.</p>${pairTable(rows)}</section>
<section><h2>Resumo</h2>${table}</section>
<section><h2>Criatividade, riqueza e variedade</h2><p class="intro">Briefs abertos. Originalidade, riqueza e forma são notas de 1 a 5 de um segundo juiz de criatividade; as métricas de riqueza vêm do documento final; a distância de layout (0 a 1) e de paleta (ΔE00) medem o quanto as peças de um mesmo modelo diferem entre si; convergência aponta valores que se repetem em peças sem relação.</p>${creativityTable(rows)}</section>
${filters}
${section("Réplica", "replica", "Blocos, texto e posição seguem o método do Design2Code, aplicado às camadas do documento; ΔE00 compara a cor de cada par; SSIM compara as duas renderizações. A semelhança é a nota do juiz de visão, de 1 a 5.", replicate)}
${section("Brief aberto", "brief", "Notas de 1 a 5 de um juiz de visão de outra família de modelo, com o motivo de cada critério; os defeitos vêm dos mesmos relatórios de percepção e verificações de design que a Elo usa.", open)}
</div>
<script>
const boxes = [...document.querySelectorAll('[data-filter]')];
function apply() {
  const on = (kind) => new Set(boxes.filter((b) => b.dataset.filter === kind && b.checked).map((b) => b.value));
  const models = on('model');
  const arms = on('perception');
  const rounds = on('round');
  const tierSet = on('tier');
  document.querySelectorAll('.item[data-tier]').forEach((item) => item.classList.toggle('hidden-by-filter', !tierSet.has(item.dataset.tier)));
  document.querySelectorAll('.attempt[data-model]').forEach((card) => {
    card.classList.toggle('hidden-by-filter', !(models.has(card.dataset.model) && arms.has(card.dataset.perception) && rounds.has(card.dataset.round)));
  });
}
boxes.forEach((b) => b.addEventListener('change', apply));
</script>
`;
}

function readAll(out: string, prefix: string): JudgeRecord[] {
  const pattern = new RegExp(`^${prefix}.*\\.json$`);
  return readdirSync(out)
    .filter((name) => pattern.test(name) && statSync(join(out, name)).isFile())
    .sort()
    .flatMap((name) => JSON.parse(readFileSync(join(out, name), "utf8")) as JudgeRecord[]);
}

export function writeReport(out: string, gradedPath: string, tiers: ReadonlyMap<string, TierOf>, rule: string): void {
  if (!existsSync(gradedPath)) {
    console.log("nothing graded yet; the report needs graded.json");
    return;
  }
  const graded = JSON.parse(readFileSync(gradedPath, "utf8")) as GradedRun[];
  const judged = readAll(out, "judge-results");
  const creative = readAll(out, "creativity-results");
  const paired = readAll(out, "pairwise-results");
  const invalidPath = join(out, "invalid.json");
  const rules = existsSync(invalidPath) ? (JSON.parse(readFileSync(invalidPath, "utf8")) as InvalidRule[]) : [];
  const inputs = JSON.parse(readFileSync(join(out, "bench-inputs.json"), "utf8")) as { references: ReferenceRow[]; briefs: { id: string; title: string; text: string }[] };
  const unsorted = rowsOf(graded, judged, creative, paired, rules, tiers);
  const costPerRun = new Map([...new Set(unsorted.map((row) => row.model))].map((model) => [model, mean(unsorted.filter((row) => row.model === model).map((row) => row.cost)) ?? 0]));
  const rows = unsorted.sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || (costPerRun.get(b.model) ?? 0) - (costPerRun.get(a.model) ?? 0));
  const notesPath = join(out, "notes.json");
  const notes = existsSync(notesPath) ? (JSON.parse(readFileSync(notesPath, "utf8")) as string[]) : [];
  const judgeCost = [...judged, ...creative, ...paired].reduce((sum, record) => sum + record.cost_usd, 0);
  const judgeModel = judged[0]?.model ?? "";
  const gallery = join(out, "gallery");
  const images = [...inputs.references.map((ref) => ref.image), ...rows.flatMap((row) => (row.image && !row.invalid ? [row.image] : [])), ...rows.flatMap((row) => (row.versus ? [row.versus.eloLeft] : []))];
  for (const image of images) {
    const target = join(gallery, "img", image);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(out, image), target);
  }
  writeFileSync(join(gallery, "index.html"), html(rows, inputs.references, inputs.briefs, judgeCost, judgeModel, notes, tiers, rule));
  writeFileSync(join(out, "results.md"), [pairMarkdown(rows), "", markdown(rows.filter((r) => !r.invalid), judgeCost)].join("\n"));
  console.log(`report: ${join(gallery, "index.html")} with ${images.length} images; table in ${join(out, "results.md")}`);
}
