"use client";

import "./font-faces";

import { cssFontOf, fontStyleOf, STUDIO_FONTS, type FontId } from "@/lib/studio/fonts";

const loaded = new Map<string, Promise<void>>();

export class FontUnavailableError extends Error {
  constructor(readonly fontId: FontId) {
    super(`studio font ${fontId} could not be loaded`);
  }
}

export function konvaFontFamily(fontId: FontId): string {
  return `"${STUDIO_FONTS[fontId].family}"`;
}

export function konvaFontStyle(fontId: FontId, weight: number, italic: boolean): string {
  const style = fontStyleOf(fontId, weight, italic);
  return `${style.italic ? "italic " : ""}${style.weight}`;
}

export function ensureFont(fontId: FontId, weight: number, italic: boolean = false): Promise<void> {
  const css = cssFontOf(fontId, weight, italic, 32);
  const cached = loaded.get(css);
  if (cached) return cached;
  const loading = document.fonts.load(css).then((faces) => {
    if (faces.length === 0 || !document.fonts.check(css)) throw new FontUnavailableError(fontId);
  });
  loaded.set(css, loading);
  loading.catch(() => loaded.delete(css));
  return loading;
}
