import { createInterface } from "node:readline";
import { join } from "node:path";

import { withHarness, type Devtools } from "../studio-perf/harness";
import { PHOTO_HARNESS } from "./library-photos";

const HERE = import.meta.dir;
const PERCEPTION_OFF = process.argv.includes("--perception=off");

interface Request {
  id: number;
  op: "open" | "command" | "document";
  project?: string;
  spec?: unknown;
  command?: unknown;
}

function write(message: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function answer(page: Devtools, request: Request): Promise<Record<string, unknown>> {
  switch (request.op) {
    case "open":
      await page.evaluate(`window.bench.open(${JSON.stringify(request.project)}, ${JSON.stringify(request.spec)})`);
      return {};
    case "command":
      return { reply: await page.evaluate(`window.bench.run(${JSON.stringify(request.command)})`) };
    case "document":
      return { document: await page.evaluate("window.bench.document()") };
  }
  throw new Error(`unknown bridge request ${String((request as { op?: unknown }).op)}`);
}

await withHarness(
  async ({ page }) => {
    page.quiet = true;
    write({ ready: true, perception: PERCEPTION_OFF ? "off" : "on" });
    for await (const line of createInterface({ input: process.stdin })) {
      if (line.trim() === "") continue;
      const request = JSON.parse(line) as Request;
      try {
        write({ id: request.id, ...(await answer(page, request)) });
      } catch (error) {
        write({ id: request.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
  },
  {
    entry: join(HERE, "page.ts"),
    path: "/",
    ready: "Boolean(window.bench)",
    worker: true,
    ...PHOTO_HARNESS,
    modules: PERCEPTION_OFF ? { "@/lib/studio/agent/look-reports": join(HERE, "without-perception.ts") } : {},
  },
);
