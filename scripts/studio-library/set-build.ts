import { readFileSync } from "node:fs";

import { roundedSubpaths } from "../../src/lib/studio/export-scene";
import { subpathsToPath } from "../../src/lib/studio/path-nodes";
import { parseSvgArt } from "../../src/lib/studio/svg-import";
import type { EmojiArt, EmojiPart, PartStyle } from "../../src/lib/studio/library/sets/format";

const UNSUPPORTED_SVG = /<(defs|clipPath|mask|filter|linearGradient|radialGradient|pattern|image|text|use)\b/;

export function compactArt(svg: string, decimals: number): EmojiArt | string {
  if (UNSUPPORTED_SVG.test(svg)) return "uses clipping, gradients, filters or references";
  const parsed = parseSvgArt(svg);
  if (!parsed.ok) return parsed.reason;
  if (parsed.skipped > 0) return "holds elements the importer skips";
  const parts: EmojiPart[] = [];
  for (const part of parsed.art.parts) {
    if (!part.fill && !part.open) return "has a part with a fill the importer cannot read";
    if (part.gradient) return "uses a gradient";
    const path = subpathsToPath(roundedSubpaths(part.subpaths, decimals));
    const style: PartStyle = {};
    if (part.opacity < 1) style.o = part.opacity;
    if (part.evenOdd) style.e = 1;
    if (part.stroke && part.strokeWidth) {
      style.s = part.stroke;
      style.w = Math.round(part.strokeWidth * 1000) / 1000;
      style.k = part.strokeShape;
    }
    parts.push(Object.keys(style).length > 0 ? [path, part.fill ?? "", style] : [path, part.fill ?? ""]);
  }
  const { frame } = parsed.art;
  if (frame.x !== 0 || frame.y !== 0) return "has a view box that does not start at zero";
  return { w: frame.width, h: frame.height, p: parts };
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function moduleText(value: unknown): string {
  return `const data = ${JSON.stringify(JSON.stringify(value))};\n\nexport default data;\n`;
}

const DASHES = [String.fromCodePoint(0x2013), String.fromCodePoint(0x2014)];

export function plainDashes(text: string): string {
  return DASHES.reduce((out, dash) => out.split(dash).join("-"), text);
}

export function unique(words: readonly string[]): string[] {
  return [...new Set(words.map((word) => plainDashes(word).trim().toLowerCase()).filter((word) => word !== ""))];
}

export function chunked<T>(entries: readonly T[], size: (entry: T) => number, limit: number): T[][] {
  const chunks: T[][] = [[]];
  let bytes = 0;
  for (const entry of entries) {
    const own = size(entry);
    if (bytes + own > limit && chunks[chunks.length - 1].length > 0) {
      chunks.push([]);
      bytes = 0;
    }
    chunks[chunks.length - 1].push(entry);
    bytes += own;
  }
  return chunks;
}
