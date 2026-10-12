import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { withHarness } from "../studio-perf/harness";
import { writeFixtures } from "./fixtures";
import { Flow, READY, type Scenario } from "./flow";
import { IMAGE_SCENARIOS } from "./scenarios/image";
import { LIBRARY_SCENARIOS } from "./scenarios/library";
import { VIDEO_SCENARIOS } from "./scenarios/video";

const HERE = import.meta.dir;
const IGNORED_CONSOLE = [/Download the React DevTools/];
const SCENARIO_TIMEOUT_MS = 120_000;

const filter = process.argv.slice(2).join(" ").toLowerCase();
const scenarios: Scenario[] = [...IMAGE_SCENARIOS, ...VIDEO_SCENARIOS, ...LIBRARY_SCENARIOS].filter((scenario) => filter === "" || filter.split("|").some((part) => scenario.name.toLowerCase().includes(part.trim()) || scenario.editor === part.trim()));
const out = process.env.STUDIO_E2E_OUT ?? join(HERE, ".out");
mkdirSync(out, { recursive: true });

interface Outcome {
  scenario: Scenario;
  passed: boolean;
  failures: string[];
  shots: string[];
  errors: string[];
}

function slug(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

const outcomes = await withHarness(
  async ({ page, downloads }) => {
    page.quiet = true;
    const results: Outcome[] = [];
    for (const [index, scenario] of scenarios.entries()) {
      const flow = new Flow(page, scenario.editor, out, `${String(index + 1).padStart(2, "0")}-${scenario.editor}-${slug(scenario.name)}`, downloads);
      let crashed: string | null = null;
      try {
        await Promise.race([flow.open().then(() => scenario.run(flow)), Bun.sleep(SCENARIO_TIMEOUT_MS).then(() => Promise.reject(new Error(`timed out after ${SCENARIO_TIMEOUT_MS / 1000} s`)))]);
      } catch (error) {
        crashed = error instanceof Error ? (error.stack ?? error.message).split("\n").slice(0, 3).join(" ") : String(error);
      }
      const errors = page.errors.filter((line) => !IGNORED_CONSOLE.some((pattern) => pattern.test(line)));
      try {
        await flow.screenshot("end");
      } catch {
        flow.shots.push("(screenshot failed)");
      }
      const failures = [...flow.checks.filter((check) => !check.ok).map((check) => `${check.name}${check.detail ? ` (${check.detail.slice(0, 300)})` : ""}`), ...(crashed ? [`crashed: ${crashed}`] : []), ...errors.map((line) => `console: ${line.split("\n")[0].slice(0, 300)}`)];
      const outcome = { scenario, passed: failures.length === 0, failures, shots: flow.shots, errors };
      results.push(outcome);
      console.log(`${outcome.passed ? "PASS" : scenario.pending ? "FAIL (pending)" : "FAIL"}  [${scenario.editor}] ${scenario.name}`);
      for (const line of failures) console.log(`        ${line}`);
      if (!outcome.passed && scenario.pending) console.log(`        pending: ${scenario.pending}`);
      page.errors.length = 0;
    }
    return results;
  },
  { entry: join(HERE, "page.ts"), path: "/?editor=image", ready: READY.image, worker: true, overrides: { "@/app/actions/medias": join(HERE, "stub-medias.ts"), "@/app/actions/studio-library": join(HERE, "stub-studio-library.ts") }, fixtures: writeFixtures },
);

const summary = outcomes.map((o) => ({ editor: o.scenario.editor, name: o.scenario.name, passed: o.passed, pending: o.scenario.pending ?? null, failures: o.failures, shots: o.shots }));
writeFileSync(join(out, "results.json"), JSON.stringify(summary, null, 2));
const failed = outcomes.filter((o) => !o.passed);
console.log(`\n${outcomes.length - failed.length} passed, ${failed.length} failed (${failed.filter((o) => o.scenario.pending).length} pending on unfinished features). Screenshots in ${out}`);
process.exit(failed.some((o) => !o.scenario.pending) ? 1 : 0);
