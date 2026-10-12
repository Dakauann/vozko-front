import type { EmojiArt, EmojiPart } from "../sets/format";

export function filled(path: string, color: string, opacity?: number): EmojiPart {
  return opacity === undefined ? [path, color] : [path, color, { o: opacity }];
}

export function stroked(path: string, color: string, width: number, opacity?: number): EmojiPart {
  return [path, "", { s: color, w: width, k: { lineCap: "round", lineJoin: "round" }, ...(opacity !== undefined ? { o: opacity } : {}) }];
}

export function holed(path: string, color: string): EmojiPart {
  return [path, color, { e: 1 }];
}

export function art(w: number, h: number, parts: readonly EmojiPart[]): EmojiArt {
  return { w, h, p: parts };
}
