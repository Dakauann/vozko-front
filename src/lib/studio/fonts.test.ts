import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { FONT_CATEGORIES, FONT_IDS, fontsIn, STUDIO_FONTS, type FontId } from "./fonts";
import { FONT_FIXTURE_PATH, fontFixture } from "./font-fixture";
import { FONT_SPRITE, fontSpriteOffset } from "./font-sprite";

const FRONT = resolve(__dirname, "../../..");
const ROOT = resolve(FRONT, "..");
const FACE_IMPORT = /^import "@fontsource\/([a-z0-9-]+)\/([a-z0-9-]+)\.css";$/;

interface Face {
  id: string;
  subset: string;
  weight: number;
  italic: boolean;
}

function declaredFaces(): Face[] {
  const source = readFileSync(resolve(FRONT, "src/components/studio/canvas/font-faces.ts"), "utf8");
  return source
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const match = FACE_IMPORT.exec(line.trim());
      if (!match) throw new Error(`unexpected font face line: ${line}`);
      const [subset, weight, style] = match[2].split("-");
      return { id: match[1], subset, weight: Number(weight), italic: style === "italic" };
    });
}

function packageFile(id: string, file: string): string {
  return readFileSync(resolve(FRONT, "node_modules/@fontsource", id, file), "utf8");
}

describe("the studio fonts", () => {
  it("offers about fifty families, each in one of the five categories", () => {
    expect(FONT_IDS.length).toBe(50);
    expect(new Set(FONT_IDS).size).toBe(FONT_IDS.length);
    for (const id of FONT_IDS) expect(FONT_CATEGORIES, id).toContain(STUDIO_FONTS[id].category);
    for (const category of FONT_CATEGORIES) expect(fontsIn(category).length, category).toBeGreaterThanOrEqual(5);
    expect(FONT_CATEGORIES.flatMap(fontsIn).sort()).toEqual([...FONT_IDS].sort());
  });

  it("matches the font list the backend validates", () => {
    const committed = readFileSync(resolve(ROOT, FONT_FIXTURE_PATH), "utf8").replace(/\r\n/g, "\n");
    expect(committed, `${FONT_FIXTURE_PATH} is stale`).toBe(fontFixture());
  });

  it("declares exactly the latin faces each family lists, nothing more", () => {
    const faces = declaredFaces();
    for (const face of faces) expect(face.subset, `${face.id} ${face.weight}`).toBe("latin");
    for (const id of FONT_IDS) {
      const own = faces.filter((face) => face.id === id);
      const font = STUDIO_FONTS[id];
      expect([...new Set(own.filter((face) => !face.italic).map((face) => face.weight))].sort((a, b) => a - b), id).toEqual([...font.weights]);
      const italics = own.filter((face) => face.italic).map((face) => face.weight);
      expect(italics.sort((a, b) => a - b), id).toEqual(font.italic ? [...font.weights] : []);
    }
    expect(new Set(faces.map((face) => face.id))).toEqual(new Set<string>(FONT_IDS));
  });

  it("loads every face on demand with swap, from an OFL package whose family name matches", () => {
    for (const face of declaredFaces()) {
      const css = packageFile(face.id, `latin-${face.weight}${face.italic ? "-italic" : ""}.css`);
      expect(css, face.id).toContain("font-display: swap;");
      expect(css, face.id).toContain(`font-family: '${STUDIO_FONTS[face.id as FontId].family}';`);
    }
    for (const id of FONT_IDS) {
      expect(JSON.parse(packageFile(id, "package.json")).license, id).toBe("OFL-1.1");
      expect(packageFile(id, "LICENSE"), id).toMatch(/SIL OPEN FONT LICENSE/i);
    }
  });
});

describe("the font name sprite", () => {
  it("has one row per family at the declared size", () => {
    const png = readFileSync(resolve(FRONT, `public${FONT_SPRITE.src}`));
    expect(png.readUInt32BE(16)).toBe(FONT_SPRITE.width * FONT_SPRITE.scale);
    expect(png.readUInt32BE(20)).toBe(FONT_SPRITE.row * FONT_SPRITE.scale * FONT_IDS.length);
    expect(fontSpriteOffset("dm-mono")).toBe((FONT_IDS.length - 1) * FONT_SPRITE.row);
  });

  it("loads the faces from one module the studio imports lazily, never from the app shell", () => {
    const sources = (readdirSync(resolve(FRONT, "src"), { recursive: true }) as string[]).filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file));
    const importers = sources.filter((file) => /font-faces"/.test(readFileSync(resolve(FRONT, "src", file), "utf8")));
    expect(importers.map((file) => file.replace(/\\/g, "/"))).toEqual(["components/studio/canvas/ensure-font.ts"]);
  });
});
