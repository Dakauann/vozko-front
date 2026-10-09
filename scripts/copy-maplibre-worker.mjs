import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const dist = join(dirname(require.resolve("maplibre-gl/package.json")), "dist");
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "maplibre");
const files = ["maplibre-gl-worker.mjs", "maplibre-gl-worker.mjs.map"];

mkdirSync(target, { recursive: true });
for (const file of files) {
  const source = join(dist, file);
  if (!existsSync(source)) throw new Error(`maplibre worker file missing: ${source}`);
  copyFileSync(source, join(target, file));
}
console.log(`maplibre worker copied to ${target}`);
