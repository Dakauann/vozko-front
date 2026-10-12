import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { STUDIO_ICON_IDS } from "@/components/studio/canvas/icon-catalog";

import { gradeBriefRun } from "./brief-grade";

interface LiveRun {
  brief: string;
  model: string;
  batches: unknown[];
  cost_usd: number;
}

const runsFile = process.env.ELO_EVAL_RUNS;

function liveRuns(): LiveRun[] {
  return runsFile ? (JSON.parse(readFileSync(runsFile, "utf8")) as LiveRun[]) : [];
}

describe.skipIf(!runsFile)("live Elo design runs, graded offline", () => {
  const runs = liveRuns();

  it("read at least one run", () => {
    expect(runs.length).toBeGreaterThan(0);
  });

  it.each(runs.map((run) => [`${run.model} · ${run.brief}`, run] as const))("%s applies cleanly and leaves no error line", (_, run) => {
    const grade = gradeBriefRun(run.batches, STUDIO_ICON_IDS);
    console.table({ brief: run.brief, model: run.model, batches: run.batches.length, layers: grade.layers, paths: grade.paths, errors: grade.errors.length, warnings: grade.warnings.length, ignored: grade.ignored.length, angles: grade.angles.length, cost_usd: run.cost_usd });
    expect(run.batches.length).toBeGreaterThan(0);
    expect(grade.failures).toEqual([]);
    expect(grade.errors).toEqual([]);
    expect(grade.angleNotes).toEqual([]);
  });
});
