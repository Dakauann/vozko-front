import { join } from "node:path";

import type { HarnessOptions } from "../studio-perf/harness";
import { writeImageFixtures } from "./image-files";

const HERE = import.meta.dir;
const BRAND_PREFIX = "NEXT_PUBLIC_BRAND_";

export const READY = "Boolean(window.harness && window.harness.ready())";

function brandDefines(): Record<string, string> {
  const brand = Object.entries(process.env).filter(([key, value]) => key.startsWith(BRAND_PREFIX) && value);
  if (brand.length === 0) throw new Error(`No ${BRAND_PREFIX}* variables in the environment; the editor header needs them (vozko-front/.env).`);
  return Object.fromEntries(brand.map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)]));
}

export function workflowsHarnessOptions(): HarnessOptions {
  return {
    entry: join(HERE, "page.ts"),
    ready: READY,
    modules: { "@/app/actions/workflows": join(HERE, "actions-stub.ts") },
    overrides: { "@/app/actions/medias": join(HERE, "medias-stub.ts") },
    fixtures: writeImageFixtures,
    define: brandDefines(),
  };
}
