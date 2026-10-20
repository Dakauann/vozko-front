import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { navigate, withHarness } from "../studio-perf/harness";
import { READY, workflowsHarnessOptions } from "./harness-options";

const ZOOMS = [0.2, 0.3, 0.45, 0.6, 1, 1.5];
const SHOT_SETTLE_MS = 1200;
const FIXTURES = [
  { name: "text", focus: "t6" },
  { name: "images", focus: "m13" },
];

const out = process.argv[2];
const label = process.argv[3] ?? "shot";
if (!out) throw new Error("usage: bun scripts/workflows-perf/shots.ts <output dir> [label]");
mkdirSync(out, { recursive: true });

await withHarness(async ({ page }) => {
  for (const fixture of FIXTURES) {
    await navigate(page, `/?fixture=${fixture.name}`, READY);
    for (const zoom of ZOOMS) {
      await page.evaluate(`harness.focus(${JSON.stringify(fixture.focus)}, ${zoom})`);
      await Bun.sleep(SHOT_SETTLE_MS);
      const { data } = (await page.send("Page.captureScreenshot", { format: "png" })) as { data: string };
      const file = join(out, `${label}-${fixture.name}-zoom-${zoom}.png`);
      writeFileSync(file, Buffer.from(data, "base64"));
      console.log(file);
    }
  }
}, workflowsHarnessOptions());
