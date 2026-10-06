"use client";

import { useEffect, useMemo, useState } from "react";

import { loadAssetImage } from "@/components/studio/canvas/asset-images";
import { ensureFont } from "@/components/studio/canvas/ensure-font";
import type { Layer } from "@/lib/studio/document";
import { DEFAULT_FONT_ID, DEFAULT_FONT_WEIGHT, isFontId } from "@/lib/studio/fonts";

export type Readiness = "loading" | "ready" | "failed";

function requirements(layers: readonly Layer[]): string[] {
  const keys = new Set<string>();
  for (const layer of layers) {
    if (layer.hidden) continue;
    if (layer.type === "image" && layer.assetId) keys.add(`a|${layer.assetId}`);
    if (layer.type === "text") keys.add(`f|${layer.fontId ?? DEFAULT_FONT_ID}|${layer.fontWeight || DEFAULT_FONT_WEIGHT}|${layer.italic ? 1 : 0}`);
  }
  return [...keys].sort();
}

function load(key: string): Promise<unknown> {
  const [kind, a, b, c] = key.split("|");
  if (kind === "a") return loadAssetImage(a);
  if (!isFontId(a)) return Promise.reject(new Error(`unknown font ${a}`));
  return ensureFont(a, Number(b), c === "1");
}

export function useDocumentReadiness(layers: readonly Layer[]): Readiness {
  const keys = useMemo(() => requirements(layers), [layers]);
  const signature = keys.join(",");
  const [settled, setSettled] = useState<{ signature: string; status: Readiness } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const wanted = signature === "" ? [] : signature.split(",");
    void Promise.allSettled(wanted.map(load)).then((results) => {
      if (cancelled) return;
      setSettled({ signature, status: results.every((r) => r.status === "fulfilled") ? "ready" : "failed" });
    });
    return () => {
      cancelled = true;
    };
  }, [signature]);

  return settled?.signature === signature ? settled.status : "loading";
}
