import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { JSDOM } from "jsdom";

import { EMOJI_GROUPS, ICON_WEIGHTS, type EmojiArt, type EmojiIndexEntry, type IconIndexEntry, type IconPaths, type Names, type SetNotice } from "../../src/lib/studio/library/sets/format";
import { chunked, compactArt, moduleText, plainDashes, readJson, unique } from "./set-build";

const { values } = parseArgs({
  options: {
    icons: { type: "string" },
    emoji: { type: "string" },
    cldr: { type: "string" },
  },
});

if (!values.icons || !values.emoji || !values.cldr) {
  console.error("usage: bun scripts/studio-library/sets.ts --icons <@phosphor-icons/core package dir> --emoji <fluentui-emoji checkout> --cldr <dir holding cldr-annotations-full and cldr-annotations-derived-full>");
  process.exit(1);
}

globalThis.DOMParser = new JSDOM().window.DOMParser as unknown as typeof DOMParser;

const OUT = resolve(import.meta.dir, "../../src/lib/studio/library/sets/data");
const DATA = resolve(import.meta.dir, "data");
const CHUNK_BYTES = 160_000;
const EMOJI_DECIMALS = 3;
const VARIATION_SELECTOR = String.fromCodePoint(0xfe0f);
const DROPPED_ICONS = new Set(["phosphor-logo"]);
const GROUPS: Record<string, (typeof EMOJI_GROUPS)[number]> = {
  "Smileys & Emotion": "smileys",
  "People & Body": "people",
  "Animals & Nature": "animals",
  "Food & Drink": "food",
  "Travel & Places": "travel",
  Activities: "activities",
  Objects: "objects",
  Symbols: "symbols",
  Flags: "flags",
};

function write(name: string, text: string): number {
  writeFileSync(join(OUT, name), text);
  return text.length;
}

interface PhosphorIcon {
  name: string;
  tags: string[];
}

function iconPaths(svg: string, file: string): IconPaths {
  const elements = [...svg.matchAll(/<(\w+)([^>]*)>/g)].map((match) => match[1]).filter((name) => name !== "svg");
  if (elements.some((name) => name !== "path")) throw new Error(`${file} holds something other than paths`);
  return [...svg.matchAll(/<path([^>]*)\/?>/g)].map((match) => {
    const data = /\sd="([^"]+)"/.exec(match[1])?.[1];
    if (!data) throw new Error(`${file} has a path without data`);
    const opacity = /\sopacity="([^"]+)"/.exec(match[1])?.[1];
    return opacity === undefined ? data : ([data, Number(opacity)] as const);
  });
}

async function buildIcons(root: string): Promise<{ count: number; notice: SetNotice; loaders: string[] }> {
  const pkg = readJson<{ version: string; license: string }>(join(root, "package.json"));
  const { icons } = (await import(pathToFileURL(join(root, "dist/index.mjs")).href)) as { icons: PhosphorIcon[] };
  const names = readJson<Record<string, { en: string; pt: string; es: string; de: string }>>(join(DATA, "icon-names.json"));
  const tagsPt = readJson<Record<string, string>>(join(DATA, "icon-tags-pt.json"));
  const kept = icons.filter((icon) => !DROPPED_ICONS.has(icon.name));
  const missing = kept.filter((icon) => !names[icon.name]).map((icon) => icon.name);
  if (missing.length > 0) throw new Error(`translate these icon names in scripts/studio-library/data/icon-names.json first: ${missing.join(", ")}`);
  const index: IconIndexEntry[] = kept.map((icon) => {
    const label = names[icon.name];
    const english = unique(icon.tags.filter((tag) => !tag.startsWith("*")));
    const untranslated = english.filter((tag) => !tagsPt[tag]);
    if (untranslated.length > 0) throw new Error(`translate these tags in scripts/studio-library/data/icon-tags-pt.json first: ${untranslated.join(", ")}`);
    return { n: icon.name, l: [label.en, label.pt, label.es, label.de] as Names, t: unique([...english, "icon"]), p: unique([...english.map((tag) => tagsPt[tag]), "ícone"]) };
  });
  write("icon-index.ts", moduleText(index));
  const loaders: string[] = [];
  const perChunk: Record<string, number> = {};
  for (const weight of ICON_WEIGHTS) {
    const paths = kept.map((icon) => {
      const file = join(root, "assets", weight, weight === "regular" ? `${icon.name}.svg` : `${icon.name}-${weight}.svg`);
      return iconPaths(readFileSync(file, "utf8"), file);
    });
    const average = JSON.stringify(paths).length / paths.length;
    const size = Math.max(1, Math.floor(CHUNK_BYTES / average));
    perChunk[weight] = size;
    const files: string[] = [];
    for (let start = 0, n = 0; start < paths.length; start += size, n++) {
      const name = `icons-${weight}-${n}`;
      write(`${name}.ts`, moduleText(paths.slice(start, start + size)));
      files.push(`() => import("./${name}")`);
    }
    loaders.push(`  ${weight}: [${files.join(", ")}],`);
  }
  const text = readFileSync(join(root, "LICENSE"), "utf8").trim();
  return {
    count: kept.length,
    notice: { id: "icons", name: "Phosphor Icons", version: pkg.version, url: "https://github.com/phosphor-icons/core", license: pkg.license, text },
    loaders: [`export const ICON_INDEX = () => import("./icon-index");`, `export const ICON_CHUNK_SIZE = ${JSON.stringify(perChunk)} as const;`, `export const ICON_CHUNKS = {`, ...loaders, `} as const;`],
  };
}

type Annotations = Record<string, { default?: string[]; tts?: string[] }>;

function annotations(root: string, locale: string): Annotations {
  const base = readJson<{ annotations: { annotations: Annotations } }>(join(packageDir(root, "cldr-annotations-full"), "annotations", locale, "annotations.json")).annotations.annotations;
  const derived = readJson<{ annotationsDerived: { annotations: Annotations } }>(join(packageDir(root, "cldr-annotations-derived-full"), "annotationsDerived", locale, "annotations.json")).annotationsDerived.annotations;
  return { ...derived, ...base };
}

function packageDir(root: string, name: string): string {
  const nested = join(root, name, "package");
  return existsSync(nested) ? nested : join(root, name);
}

interface FluentMeta {
  cldr: string;
  glyph: string;
  group: string;
  unicode: string;
}

function walk(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, found);
    else found.push(path);
  }
  return found;
}

function flatSvg(dir: string): string | null {
  const svgs = walk(dir).filter((path) => path.endsWith(".svg"));
  const flat = svgs.filter((path) => /[\\/]Flat[\\/]/.test(path) || /flat/i.test(path.split(/[\\/]/).pop() ?? ""));
  return flat.find((path) => /[\\/]Default[\\/]/.test(path)) ?? flat[0] ?? null;
}

function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}


function buildEmoji(root: string, cldrRoot: string): { count: number; skipped: string[]; notices: SetNotice[]; loaders: string[] } {
  const locales = ["en", "pt", "es", "de"] as const;
  const cldr = Object.fromEntries(locales.map((locale) => [locale, annotations(cldrRoot, locale)])) as Record<(typeof locales)[number], Annotations>;
  const lookup = (locale: (typeof locales)[number], glyph: string) => cldr[locale][glyph] ?? cldr[locale][glyph.split(VARIATION_SELECTOR).join("")];
  const metas = walk(join(root, "assets")).filter((path) => path.endsWith("metadata.json"));
  const skipped: string[] = [];
  const seen = new Set<string>();
  const rows: { entry: Omit<EmojiIndexEntry, "k" | "i">; art: EmojiArt; order: string }[] = [];
  for (const metaPath of metas) {
    const meta = readJson<FluentMeta>(metaPath);
    const dir = metaPath.slice(0, -"metadata.json".length);
    const group = GROUPS[meta.group];
    const svgPath = flatSvg(dir);
    if (!group || !svgPath) {
      skipped.push(`${meta.cldr}: no flat drawing or unknown group`);
      continue;
    }
    const art = compactArt(readFileSync(svgPath, "utf8"), EMOJI_DECIMALS);
    if (typeof art === "string") {
      skipped.push(`${meta.cldr}: ${art}`);
      continue;
    }
    const names = locales.map((locale) => plainDashes(lookup(locale, meta.glyph)?.tts?.[0] ?? ""));
    if (names.some((name) => name === "")) {
      skipped.push(`${meta.cldr}: no name in every language`);
      continue;
    }
    const base = `emoji-${slug(meta.cldr) || meta.unicode.replace(/\s+/g, "-")}`;
    const id = seen.has(base) ? `${base}-${meta.unicode.replace(/\s+/g, "-")}` : base;
    seen.add(id);
    const capitalized = names.map((name) => name.charAt(0).toLocaleUpperCase() + name.slice(1)) as unknown as Names;
    const tags = (locale: "en" | "pt") => unique([...(lookup(locale, meta.glyph)?.default ?? []), "emoji"]);
    const order = `${EMOJI_GROUPS.indexOf(group)}-${meta.unicode
      .split(/\s+/)
      .map((code) => code.padStart(6, "0"))
      .join("-")}`;
    rows.push({ entry: { id, g: EMOJI_GROUPS.indexOf(group), l: capitalized, t: tags("en"), p: tags("pt") }, art, order });
  }
  rows.sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
  const chunks = chunked(rows, (row) => JSON.stringify(row.art).length, CHUNK_BYTES);
  const index: EmojiIndexEntry[] = [];
  const files: string[] = [];
  chunks.forEach((chunk, k) => {
    chunk.forEach((row, i) => index.push({ ...row.entry, k, i }));
    write(`emoji-${k}.ts`, moduleText(chunk.map((row) => row.art)));
    files.push(`() => import("./emoji-${k}")`);
  });
  write("emoji-index.ts", moduleText(index));
  const cldrPkg = readJson<{ version: string }>(join(packageDir(cldrRoot, "cldr-annotations-full"), "package.json"));
  return {
    count: rows.length,
    skipped,
    notices: [
      { id: "emoji", name: "Fluent Emoji", version: "main", url: "https://github.com/microsoft/fluentui-emoji", license: "MIT", text: readFileSync(join(root, "LICENSE"), "utf8").trim().replace(/^ {4}/gm, "") },
      { id: "emoji-names", name: "Unicode CLDR", version: cldrPkg.version, url: "https://github.com/unicode-org/cldr-json", license: "Unicode-3.0", text: readFileSync(join(packageDir(cldrRoot, "cldr-annotations-full"), "LICENSE"), "utf8").trim() },
    ],
    loaders: [`export const EMOJI_INDEX = () => import("./emoji-index");`, `export const EMOJI_CHUNKS = [${files.join(", ")}] as const;`],
  };
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const icons = await buildIcons(resolve(values.icons));
const emoji = buildEmoji(resolve(values.emoji), resolve(values.cldr));
write("loaders.ts", [...icons.loaders, ...emoji.loaders, ""].join("\n"));
write("notices.ts", `import type { SetNotice } from "../format";\n\nexport const SET_NOTICES: readonly SetNotice[] = ${JSON.stringify([icons.notice, ...emoji.notices], null, 2)};\n`);
console.log(`icons: ${icons.count} in ${ICON_WEIGHTS.length} weights`);
console.log(`emoji: ${emoji.count}, left out ${emoji.skipped.length}`);
for (const reason of emoji.skipped) console.log(`  left out ${reason}`);
