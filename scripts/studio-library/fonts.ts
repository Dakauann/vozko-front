import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createCanvas, GlobalFonts } from "@napi-rs/canvas";

import { FONT_METRIC_SAMPLES, FONT_METRIC_WEIGHTS } from "../../src/lib/studio/font-metrics";
import { FONT_SPRITE } from "../../src/lib/studio/font-sprite";
import { FONT_IDS, nearestFontWeight, STUDIO_FONTS, type FontId } from "../../src/lib/studio/fonts";

const FRONT = resolve(import.meta.dir, "../..");
const SIZE = 1000;
const SPRITE_WEIGHT = 400;
const BASELINE = 0.68;

function register(id: FontId, wanted: number): string {
  const weight = nearestFontWeight(id, wanted);
  const family = `studio-${id}-${weight}`;
  GlobalFonts.registerFromPath(resolve(FRONT, `node_modules/@fontsource/${id}/files/${id}-latin-${weight}-normal.woff2`), family);
  return family;
}

function rounded(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function advance(family: string, text: string): number {
  const context = createCanvas(8, 8).getContext("2d");
  context.font = `${SIZE}px "${family}"`;
  const chars = [...text].filter((char) => char !== " ");
  return rounded(context.measureText(chars.join("")).width / chars.length / SIZE);
}

function space(family: string): number {
  const context = createCanvas(8, 8).getContext("2d");
  context.font = `${SIZE}px "${family}"`;
  return rounded(context.measureText(" ").width / SIZE);
}

const metrics = Object.fromEntries(
  FONT_IDS.map((id) => {
    const byWeight = FONT_METRIC_WEIGHTS.map((wanted) => {
      const family = register(id, wanted);
      return [String(wanted), [advance(family, FONT_METRIC_SAMPLES.lower), advance(family, FONT_METRIC_SAMPLES.upper), advance(family, FONT_METRIC_SAMPLES.digits), advance(family, FONT_METRIC_SAMPLES.marks), space(family)]];
    });
    return [id, Object.fromEntries(byWeight)];
  }),
);
writeFileSync(resolve(FRONT, "src/lib/studio/font-metrics.json"), `${JSON.stringify(metrics, null, 2)}\n`);

const row = FONT_SPRITE.row * FONT_SPRITE.scale;
const sprite = createCanvas(FONT_SPRITE.width * FONT_SPRITE.scale, row * FONT_IDS.length);
const context = sprite.getContext("2d");
context.fillStyle = "#ffffff";
FONT_IDS.forEach((id, index) => {
  context.font = `${FONT_SPRITE.size * FONT_SPRITE.scale}px "${register(id, SPRITE_WEIGHT)}"`;
  context.fillText(STUDIO_FONTS[id].family, 0, index * row + row * BASELINE);
});
writeFileSync(resolve(FRONT, `public${FONT_SPRITE.src}`), sprite.toBuffer("image/png"));

console.log(`wrote metrics and the name sprite for ${FONT_IDS.length} fonts`);
