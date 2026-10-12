"use client";

import { useEffect, useState } from "react";

import type { FontId } from "@/lib/studio/fonts";

import { ensureFont } from "./ensure-font";

export interface FontRequest {
  fontId: FontId;
  weight: number;
  italic: boolean;
}

export function fontsKey(fonts: readonly FontRequest[]): string {
  return fonts.map((font) => `${font.fontId}:${font.weight}:${font.italic}`).join("|");
}

export function useFontsReady(fonts: readonly FontRequest[], fail: (error: Error) => void): { ready: boolean; key: string } {
  const key = fontsKey(fonts);
  const [loaded, setLoaded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(fonts.map((font) => ensureFont(font.fontId, font.weight, font.italic))).then(
      () => !cancelled && setLoaded(key),
      (error: Error) => !cancelled && fail(error),
    );
    return () => {
      cancelled = true;
    };
  }, [fonts, key, fail]);

  return { ready: loaded === key, key };
}
