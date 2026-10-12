import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { LIBRARY_CATEGORIES } from "../../src/components/studio/library/registry";
import de from "../../src/i18n/messages/de.json";
import en from "../../src/i18n/messages/en.json";
import es from "../../src/i18n/messages/es.json";
import pt from "../../src/i18n/messages/pt.json";
import { SOUND_FIXTURE_PATH, soundFixture } from "../../src/lib/studio/builtin-sounds";
import { FONT_FIXTURE_PATH, fontFixture } from "../../src/lib/studio/font-fixture";
import { CATALOG_PATHS, catalogFiles } from "../../src/lib/studio/library/catalog-file";
import { LOTTIE_CONVERTED_FIXTURES, LOTTIE_FIXTURE_DIR, lottieFixtureJson } from "../../src/lib/studio/lottie/lottie-fixture";

const ROOT = resolve(import.meta.dir, "../../..");

const files = await catalogFiles(LIBRARY_CATEGORIES, { pt, en, es, de });

for (const [name, path] of Object.entries(CATALOG_PATHS)) {
  const target = resolve(ROOT, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, files[name as keyof typeof CATALOG_PATHS]);
  console.log(`wrote ${path}`);
}

writeFileSync(resolve(ROOT, FONT_FIXTURE_PATH), fontFixture());
console.log(`wrote ${FONT_FIXTURE_PATH}`);

writeFileSync(resolve(ROOT, SOUND_FIXTURE_PATH), soundFixture());
console.log(`wrote ${SOUND_FIXTURE_PATH}`);

for (const name of LOTTIE_CONVERTED_FIXTURES) {
  const animation = JSON.parse(readFileSync(resolve(ROOT, LOTTIE_FIXTURE_DIR, `${name}.json`), "utf8"));
  writeFileSync(resolve(ROOT, LOTTIE_FIXTURE_DIR, `${name}.clips.json`), lottieFixtureJson(animation, name));
  console.log(`wrote ${LOTTIE_FIXTURE_DIR}/${name}.clips.json`);
}
