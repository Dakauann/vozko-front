import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { JSDOM } from "jsdom";

import { ART_SETS, type ArtIndexEntry } from "../../src/lib/studio/library/sets/art-sets";
import type { EmojiArt, Names, SetNotice } from "../../src/lib/studio/library/sets/format";
import { chunked, compactArt, moduleText, readJson } from "./set-build";

const { values } = parseArgs({
  options: {
    peeps: { type: "string" },
    humaaans: { type: "string" },
    doodles: { type: "string" },
  },
});

if (!values.peeps || !values.humaaans || !values.doodles) {
  console.error("usage: bun scripts/studio-library/art.ts --peeps <Open Peeps svg dir> --humaaans <Humaaans svg dir> --doodles <Open Doodles svg dir>");
  process.exit(1);
}

globalThis.DOMParser = new JSDOM().window.DOMParser as unknown as typeof DOMParser;

const OUT = resolve(import.meta.dir, "../../src/lib/studio/library/sets/art");
const DATA = resolve(import.meta.dir, "data");
const CHUNK_BYTES = 160_000;
const DECIMALS = 1;
const VERIFIED = "2026-10-10";

type LocalizedNames = Record<"pt" | "en" | "es" | "de", string>;

interface NameData {
  doodles: Record<string, LocalizedNames>;
  humaaans: Record<string, LocalizedNames>;
  peeps: Record<string, LocalizedNames>;
}

const names = readJson<NameData>(join(DATA, "art-names.json"));

const PEOPLE_TAGS = { en: ["person", "people", "character", "illustration"], pt: ["pessoa", "pessoas", "personagem", "ilustração"] };
const DOODLE_TAGS = { en: ["doodle", "illustration", "character"], pt: ["rabisco", "ilustração", "personagem"] };

interface Row {
  entry: Omit<ArtIndexEntry, "k" | "i">;
  art: EmojiArt;
}

function namesOf(text: LocalizedNames, suffix = ""): Names {
  return [`${text.en}${suffix}`, `${text.pt}${suffix}`, `${text.es}${suffix}`, `${text.de}${suffix}`];
}

function svgFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".svg"))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

function setIndex(id: string): number {
  const index = ART_SETS.findIndex((set) => set.id === id);
  if (index < 0) throw new Error(`unknown art set ${id}`);
  return index;
}

const skipped: string[] = [];

function converted(path: string): EmojiArt | null {
  const art = compactArt(readFileSync(path, "utf8"), DECIMALS);
  if (typeof art === "string") {
    skipped.push(`${basename(path)}: ${art}`);
    return null;
  }
  return art;
}

function row(id: string, set: string, label: Names, tags: { en: string[]; pt: string[] }, path: string): Row[] {
  const art = converted(path);
  return art ? [{ entry: { id, g: setIndex(set), l: label, t: tags.en, p: tags.pt, r: Math.round((art.w / art.h) * 1000) / 1000 }, art }] : [];
}

function peeps(dir: string): Row[] {
  const counters = new Map<string, number>();
  return svgFiles(dir).flatMap((file) => {
    const pose = file.replace(/-\d+\.svg$/, "");
    const label = names.peeps[pose];
    if (!label) throw new Error(`name the Open Peeps pose ${pose} in scripts/studio-library/data/art-names.json first`);
    const count = (counters.get(pose) ?? 0) + 1;
    const made = row(`art-${pose}-${count}`, "open-peeps", namesOf(label, ` ${count}`), PEOPLE_TAGS, join(dir, file));
    if (made.length > 0) counters.set(pose, count);
    return made;
  });
}

function named(dir: string, set: string, prefix: string, table: Record<string, LocalizedNames>, tags: { en: string[]; pt: string[] }): Row[] {
  return svgFiles(dir).flatMap((file) => {
    const key = file.replace(/\.svg$/, "");
    const label = table[key];
    if (!label) throw new Error(`name ${set}/${key} in scripts/studio-library/data/art-names.json first`);
    return row(`${prefix}-${key.toLowerCase()}`, set, namesOf(label), tags, join(dir, file));
  });
}

const CC0_TEXT = (name: string, site: string) =>
  `${name} by Pablo Stanley (${site}).\n\nDedicated to the public domain under CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). No rights reserved: the work may be copied, modified, distributed and used, even commercially, without asking permission.\n\nLicense read on the official site on ${VERIFIED}.`;

const NOTICES: SetNotice[] = [
  { id: "open-peeps", name: "Open Peeps", version: VERIFIED, url: "https://www.openpeeps.com/", license: "CC0-1.0", text: CC0_TEXT("Open Peeps", "https://www.openpeeps.com/") },
  { id: "humaaans", name: "Humaaans", version: VERIFIED, url: "https://www.humaaans.com/", license: "CC0-1.0", text: CC0_TEXT("Humaaans", "https://www.humaaans.com/") },
  { id: "open-doodles", name: "Open Doodles", version: VERIFIED, url: "https://www.opendoodles.com/", license: "CC0-1.0", text: CC0_TEXT("Open Doodles", "https://www.opendoodles.com/") },
];

const rows = [...peeps(resolve(values.peeps)), ...named(resolve(values.humaaans), "humaaans", "art-humaaans", names.humaaans, PEOPLE_TAGS), ...named(resolve(values.doodles), "open-doodles", "art-doodle", names.doodles, DOODLE_TAGS)];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const chunks = chunked(rows, (item) => JSON.stringify(item.art).length, CHUNK_BYTES);
const index: ArtIndexEntry[] = [];
const loaders: string[] = [];
chunks.forEach((chunk, k) => {
  chunk.forEach((item, i) => index.push({ ...item.entry, k, i }));
  writeFileSync(join(OUT, `art-${k}.ts`), moduleText(chunk.map((item) => item.art)));
  loaders.push(`() => import("./art-${k}")`);
});
writeFileSync(join(OUT, "index.ts"), moduleText(index));
writeFileSync(join(OUT, "loaders.ts"), `export const ART_INDEX = () => import("./index");\nexport const ART_CHUNKS = [${loaders.join(", ")}] as const;\n`);
writeFileSync(join(OUT, "notices.ts"), `import type { SetNotice } from "../format";\n\nexport const ART_NOTICES: readonly SetNotice[] = ${JSON.stringify(NOTICES, null, 2)};\n`);
const bytes = chunks.reduce((sum, chunk) => sum + JSON.stringify(chunk.map((item) => item.art)).length, 0);
console.log(`art: ${rows.length} drawings in ${chunks.length} chunks, ${Math.round(bytes / 1024)} KB`);
for (const reason of skipped) console.log(`  left out ${reason}`);
