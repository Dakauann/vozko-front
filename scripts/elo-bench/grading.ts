import type { StudioDocument } from "@/lib/studio/document";
import type { ReplicationScore } from "@/lib/studio/agent/evals/replication-score";

import type { Brief, Finding, Reference } from "./model";

export interface BenchRun {
  track: "replicate" | "brief";
  item: string;
  model: string;
  perception: "on" | "off";
  label?: string;
  document: StudioDocument | null;
  tool_calls: string[];
  model_calls: number;
  looks: number;
  edits: number;
  failed_edits: number;
  cost_usd: number;
  outcome: string;
  summary: string;
}

export const FIRST_ROUND = "1";

export function roundOf(run: Pick<BenchRun, "label">): string {
  return run.label || FIRST_ROUND;
}

export function runKey(run: BenchRun): string {
  return [run.track, run.item, run.model.replace(/[^a-z0-9.-]+/gi, "_"), run.perception, ...(run.label ? [run.label] : [])].join("__");
}

export interface GradedRun {
  key: string;
  run: BenchRun;
  image: string | null;
  inspection: { findings: Finding[]; checks: string[]; legibility: string[]; valid: boolean } | null;
  replication: { score: ReplicationScore; ssim: number } | null;
  pair: string | null;
  versus?: { eloLeft: string; realLeft: string } | null;
}

export const RUBRIC = ["hierarchy", "typography", "color", "depth", "composition", "fit", "polish"] as const;

export type RubricKey = (typeof RUBRIC)[number];

export const CREATIVITY = ["originality", "richness", "form"] as const;

export type CreativityKey = (typeof CREATIVITY)[number];

export interface JudgeVerdict {
  scores: Partial<Record<RubricKey | CreativityKey | "similarity", number>>;
  reasons: Partial<Record<RubricKey | CreativityKey | "similarity", string>>;
  worst: string;
}

const SYSTEM = [
  "You are a senior graphic design reviewer grading a finished design. Be strict and specific; most competent work scores 3, only excellent work scores 5.",
  "Score each criterion from 1 to 5 with one short reason that names what you see:",
  "hierarchy (the eye finds the most important message first, then the rest in order),",
  "typography (font choice, size contrast, spacing, line length, no awkward breaks or overflow),",
  "color (a deliberate palette, contrast, legibility),",
  "depth (shadows, layering and light: coherent, purposeful, not muddy; if the design is flat on purpose, judge whether flatness suits it),",
  "composition (balance, alignment, margins, use of space, no collisions or cut elements),",
  "fit (it serves the brief or the purpose: right content, right tone, right format),",
  "polish (finish and detail; nothing looks broken, unfinished or default).",
  "When you are shown a reference on the left and an attempt on the right, also score similarity: how faithfully the right side reproduces the left (layout, elements, text, colors, style), from 1 (unrelated) to 5 (nearly identical); score the other criteria on the right side only.",
  "Answer with JSON only, no prose around it: {\"scores\":{\"hierarchy\":n,...},\"reasons\":{\"hierarchy\":\"...\",...},\"worst\":\"the single most damaging problem\"}.",
].join(" ");

const CREATIVITY_SYSTEM = [
  "You are a senior creative director judging how creative and rich a finished design is, not whether it is correct. Be strict: a competent but generic piece scores 2 or 3; only a design with a real idea scores 5.",
  "Score each criterion from 1 to 5 with one short reason that names what you see:",
  "originality (a distinctive concept for this subject, not a generic template look; it avoids default choices such as centered stacks on a flat gradient, stock pill buttons and the same safe sans everywhere),",
  "richness (considered secondary details: decoration, texture, layering, supporting graphics, micro-typography such as labels, rules, numerals and small print),",
  "form (interesting shapes: curves, rounded or organic forms, cut-outs, overlaps and a dynamic composition where the brief allows, instead of only rectangles in a grid).",
  "Answer with JSON only, no prose around it: {\"scores\":{\"originality\":n,\"richness\":n,\"form\":n},\"reasons\":{\"originality\":\"...\",\"richness\":\"...\",\"form\":\"...\"},\"worst\":\"the biggest creative weakness\"}.",
].join(" ");

export function creativityInputs(graded: readonly GradedRun[], all: readonly Brief[]): { system: string; jobs: { case_id: string; arm: string; text: string; image: string }[] } {
  const briefsById = new Map(all.map((brief) => [brief.id, brief]));
  const jobs = graded.flatMap((entry) => {
    if (entry.run.track !== "brief" || !entry.image) return [];
    const brief = briefsById.get(entry.run.item);
    return [{ case_id: entry.key, arm: "creativity", text: `Brief given to the designer (in Portuguese): ${brief?.text ?? entry.run.item}${brief?.open.kind === "video" ? " The image is a sheet of frames from the video, labeled with their time: judge the motion too, meaning rhythm, how elements enter, variety of movement and hierarchy over time." : ""}`, image: entry.image }];
  });
  return { system: CREATIVITY_SYSTEM, jobs };
}

export const PAIR_CRITERIA = ["client", "appeal", "original", "professional", "purpose"] as const;

export type PairCriterion = (typeof PAIR_CRITERIA)[number];

export type PairSide = "elo" | "real" | "tie";

export interface PairVerdict {
  choices: Partial<Record<PairCriterion, PairSide>>;
  reasons: Partial<Record<PairCriterion, string>>;
}

export const PAIR_ARMS = { eloLeft: "pair-elo-left", realLeft: "pair-real-left" } as const;

const PAIR_SYSTEM = [
  "You are a senior art director choosing between two finished designs made for the same brief. You do not know who made either one.",
  "For each question answer left, right or tie, with one short reason that names what you see:",
  "client (which one a paying client would choose to publish),",
  "appeal (which is more visually appealing),",
  "original (which has the more distinctive, less generic idea),",
  "professional (which looks more professionally finished),",
  "purpose (which serves the brief's purpose better: message, audience, format).",
  "Use tie only when you truly cannot separate them.",
  'Answer with JSON only, no prose around it: {"choices":{"client":"left|right|tie","appeal":"...","original":"...","professional":"...","purpose":"..."},"reasons":{"client":"...","appeal":"...","original":"...","professional":"...","purpose":"..."}}.',
].join(" ");

export function pairwiseInputs(graded: readonly GradedRun[], all: readonly Brief[]): { system: string; jobs: { case_id: string; arm: string; text: string; image: string }[] } {
  const briefsById = new Map(all.map((brief) => [brief.id, brief]));
  const jobs = graded.flatMap((entry) => {
    if (entry.run.track !== "brief" || !entry.versus) return [];
    const brief = briefsById.get(entry.run.item);
    const text = `Both designs answer this brief (in Portuguese): ${brief?.text ?? entry.run.item}${brief?.open.kind === "video" ? " Each side is a sheet of frames from a video, labeled with their time: judge the motion too, meaning rhythm, how elements enter, variety of movement and hierarchy over time." : ""} The left design is on the left half, the right design on the right half.`;
    return [
      { case_id: entry.key, arm: PAIR_ARMS.eloLeft, text, image: entry.versus.eloLeft },
      { case_id: entry.key, arm: PAIR_ARMS.realLeft, text, image: entry.versus.realLeft },
    ];
  });
  return { system: PAIR_SYSTEM, jobs };
}

export function parsePair(text: string, arm: string): PairVerdict | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as { choices?: Record<string, string>; reasons?: Record<string, string> };
    if (!raw.choices) return null;
    const eloLeft = arm === PAIR_ARMS.eloLeft;
    const side = (value: string | undefined): PairSide | undefined => {
      const v = (value ?? "").toLowerCase();
      if (v === "tie") return "tie";
      if (v === "left") return eloLeft ? "elo" : "real";
      if (v === "right") return eloLeft ? "real" : "elo";
      return undefined;
    };
    const choices: Partial<Record<PairCriterion, PairSide>> = {};
    for (const key of PAIR_CRITERIA) {
      const chosen = side(raw.choices[key]);
      if (chosen) choices[key] = chosen;
    }
    return { choices, reasons: raw.reasons ?? {} };
  } catch {
    return null;
  }
}

export function onlyRound<T extends { run: BenchRun }>(entries: readonly T[], round: string, items: readonly string[]): T[] {
  const wanted = new Set(items);
  return entries.filter((entry) => roundOf(entry.run) === round && (wanted.size === 0 || wanted.has(entry.run.item)));
}

export function judgeInputs(graded: readonly GradedRun[], all: readonly Brief[], references: ReadonlyMap<string, Reference>): { system: string; jobs: { case_id: string; arm: string; text: string; image: string }[] } {
  const briefsById = new Map(all.map((brief) => [brief.id, brief]));
  const jobs = graded.flatMap((entry) => {
    if (entry.run.track === "replicate") {
      if (!entry.pair) return [];
      const reference = references.get(entry.run.item);
      return [{ case_id: entry.key, arm: "judge", text: `Left: the reference design (${reference?.title ?? entry.run.item}). Right: an attempt to recreate it in a design editor. Grade the right side and its similarity to the left.`, image: entry.pair }];
    }
    if (!entry.image) return [];
    const brief = briefsById.get(entry.run.item);
    return [{ case_id: entry.key, arm: "judge", text: `Brief given to the designer (in Portuguese): ${brief?.text ?? entry.run.item}${brief?.open.kind === "video" ? " The image is a sheet of frames from the video, labeled with their time: judge the motion too, meaning rhythm, how elements enter, variety of movement and hierarchy over time." : ""}`, image: entry.image }];
  });
  return { system: SYSTEM, jobs };
}

export function parseVerdict(text: string): JudgeVerdict | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as Partial<JudgeVerdict>;
    if (!raw.scores || typeof raw.scores !== "object") return null;
    return { scores: raw.scores, reasons: raw.reasons ?? {}, worst: typeof raw.worst === "string" ? raw.worst : "" };
  } catch {
    return null;
  }
}
