import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import type { EmojiIndexEntry, Names, SetNotice } from "../../src/lib/studio/library/sets/format";
import { THREE_D_PUBLIC_DIR, THREE_D_SETS, type ThreeDEntry } from "../../src/lib/studio/library/sets/three-d-sets";
import { readJson, unique } from "./set-build";

const { values } = parseArgs({
  options: {
    icons: { type: "string" },
    emoji: { type: "string" },
    manifest: { type: "string" },
    license: { type: "string" },
  },
});

if (!values.icons || !values.emoji || !values.manifest || !values.license) {
  console.error("usage: bun scripts/studio-library/three-d.ts --icons <3dicons png dir> --emoji <Fluent Emoji 3D png dir> --manifest <manifest.tsv of the emoji files> --license <Fluent Emoji LICENSE file>");
  process.exit(1);
}

const ROOT = resolve(import.meta.dir, "../..");
const PICTURES = join(ROOT, "public", THREE_D_PUBLIC_DIR);
const OUT = join(ROOT, "src/lib/studio/library/sets/three-d");
const DATA = resolve(import.meta.dir, "data");
const SIZE = 256;
const QUALITY = 86;
const VERIFIED = "2026-10-10";

type LocalizedNames = Record<"pt" | "en" | "es" | "de", string>;

function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function webp(source: string, id: string): { file: string; sha256: string; w: number; h: number } {
  const file = `${id}.webp`;
  const target = join(PICTURES, file);
  const result = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", source, "-vf", `scale=${SIZE}:${SIZE}:force_original_aspect_ratio=decrease`, "-c:v", "libwebp", "-quality", String(QUALITY), "-compression_level", "6", target]);
  if (result.status !== 0) throw new Error(`ffmpeg could not convert ${source}: ${result.stderr}`);
  const bytes = readFileSync(target);
  const width = bytes.readUIntLE(24, 3) + 1;
  const height = bytes.readUIntLE(27, 3) + 1;
  const isExtended = bytes.toString("ascii", 12, 16) === "VP8X";
  return { file, sha256: createHash("sha256").update(bytes).digest("hex"), w: isExtended ? width : SIZE, h: isExtended ? height : SIZE };
}

function emojiIndex(): Map<string, EmojiIndexEntry> {
  const source = readFileSync(join(ROOT, "src/lib/studio/library/sets/data/emoji-index.ts"), "utf8");
  const literal = /const data = (".*");/s.exec(source)?.[1];
  if (!literal) throw new Error("run the emoji set generator first: the emoji index is missing");
  const entries = JSON.parse(JSON.parse(literal) as string) as EmojiIndexEntry[];
  return new Map(entries.map((entry) => [entry.id, entry]));
}

const iconNames = readJson<Record<string, LocalizedNames>>(join(DATA, "icons3d-names.json"));
const emojiNames = readJson<Record<string, { names: LocalizedNames; tags: { en: string[]; pt: string[] } }>>(join(DATA, "emoji3d-names.json"));
const ICON_TAGS = { en: ["3d", "icon"], pt: ["3d", "ícone"] };
const EMOJI_TAGS = { en: ["3d", "emoji"], pt: ["3d", "emoji"] };

function icons(dir: string): ThreeDEntry[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".png"))
    .sort()
    .map((name) => {
      const key = name.replace(/-dynamic-color\.png$/, "");
      const label = iconNames[key];
      if (!label) throw new Error(`name the 3D icon ${key} in scripts/studio-library/data/icons3d-names.json first`);
      const id = `3d-icon-${key}`;
      return { id, g: 0, l: [label.en, label.pt, label.es, label.de] as Names, t: unique([label.en, ...ICON_TAGS.en]), p: unique([label.pt, ...ICON_TAGS.pt]), ...webp(join(dir, name), id) };
    });
}

function emoji(dir: string, manifest: string): ThreeDEntry[] {
  const known = emojiIndex();
  const rows = readFileSync(manifest, "utf8")
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => line.trim() !== "")
    .map((line) => line.split("\t"));
  return rows.map(([file, name]) => {
    const base = known.get(`emoji-${slug(name)}`);
    const own = emojiNames[name];
    if (!base && !own) throw new Error(`name the 3D emoji ${name} in scripts/studio-library/data/emoji3d-names.json first: the emoji index has no entry for it`);
    const id = `3d-emoji-${slug(name)}`;
    const label: Names = base ? base.l : [own.names.en, own.names.pt, own.names.es, own.names.de];
    const tags = base ? { en: base.t, pt: base.p } : own.tags;
    return { id, g: 1, l: label, t: unique([...tags.en, ...EMOJI_TAGS.en]), p: unique([...tags.pt, ...EMOJI_TAGS.pt]), ...webp(join(dir, file), id) };
  });
}

rmSync(PICTURES, { recursive: true, force: true });
mkdirSync(PICTURES, { recursive: true });
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const entries = [...icons(resolve(values.icons)), ...emoji(resolve(values.emoji), resolve(values.manifest))];
const notices: SetNotice[] = [
  {
    id: "3dicons",
    name: "3dicons",
    version: VERIFIED,
    url: "https://3dicons.co/",
    license: "CC0-1.0",
    text: `3dicons by Vijay Verma (https://3dicons.co/, https://github.com/realvjy/3dicons).\n\nDedicated to the public domain under CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Free for personal and commercial use without attribution.\n\nLicense read on the official site and repository on ${VERIFIED}.`,
  },
  { id: "fluent-emoji-3d", name: "Fluent Emoji 3D", version: "1ffb34c", url: "https://github.com/microsoft/fluentui-emoji", license: "MIT", text: readFileSync(resolve(values.license), "utf8").trim() },
];

const sets = THREE_D_SETS.map((set) => set.id).join(", ");
writeFileSync(join(OUT, "index.ts"), `import type { ThreeDEntry } from "../three-d-sets";\n\nexport const THREE_D_INDEX: readonly ThreeDEntry[] = ${JSON.stringify(entries, null, 2)};\n`);
writeFileSync(join(OUT, "notices.ts"), `import type { SetNotice } from "../format";\n\nexport const THREE_D_NOTICES: readonly SetNotice[] = ${JSON.stringify(notices, null, 2)};\n`);
const bytes = entries.reduce((sum, entry) => sum + readFileSync(join(PICTURES, entry.file)).length, 0);
console.log(`3d (${sets}): ${entries.length} pictures, ${Math.round(bytes / 1024)} KB in public/${THREE_D_PUBLIC_DIR}`);
