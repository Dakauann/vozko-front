"use client";

import { useEffect, useState } from "react";

import type { Peaks } from "@/lib/studio/waveform";

import type { AssetEntry } from "./asset-catalog";
import { useAssetState, useVideoEditor } from "./editor-context";

export function useAsset(assetId: string | undefined): AssetEntry | undefined {
  const { assets } = useVideoEditor();
  const entry = useAssetState((s) => (assetId ? s.assets[assetId] : undefined));

  useEffect(() => {
    if (assetId) void assets.ensure(assetId);
  }, [assetId, assets]);

  return entry;
}

export function useAssetUrl(assetId: string | undefined): string | null {
  const entry = useAsset(assetId);
  return entry?.status === "ready" && entry.media ? entry.media.url : null;
}

export function useSourceDuration(assetId: string | undefined): number | undefined {
  const { assets } = useVideoEditor();
  const durationMs = useAssetState((s) => (assetId ? s.assets[assetId]?.durationMs : undefined));

  useEffect(() => {
    if (assetId && durationMs === undefined) void assets.sourceDuration(assetId);
  }, [assetId, durationMs, assets]);

  return durationMs;
}

export function usePeaks(assetId: string | undefined): Peaks | null {
  const { audio } = useVideoEditor();
  const [loaded, setLoaded] = useState<{ assetId: string; peaks: Peaks | null } | null>(null);

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    void audio.peaksFor(assetId).then((peaks) => {
      if (!cancelled) setLoaded({ assetId, peaks });
    });
    return () => {
      cancelled = true;
    };
  }, [assetId, audio]);

  return loaded && loaded.assetId === assetId ? loaded.peaks : null;
}
