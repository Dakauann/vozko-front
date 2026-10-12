"use client";

import { useEffect, useState } from "react";

import { decodeAudioFile, PREVIEW_SAMPLE_RATE } from "@/components/studio/video/audio-graph";
import { channelsOf } from "@/components/studio/video/export/audio-mixdown";
import { computePeaks, overviewBars } from "@/lib/studio/waveform";

export const WAVE_BARS = 36;

export interface SoundWave {
  bars: number[];
  durationMs: number;
}

const waves = new Map<string, Promise<SoundWave | null>>();

export function soundWave(assetId: string): Promise<SoundWave | null> {
  const known = waves.get(assetId);
  if (known) return known;
  const loading = decodeAudioFile(assetId, PREVIEW_SAMPLE_RATE).then((buffer) => (buffer ? { bars: overviewBars(computePeaks(channelsOf(buffer), buffer.sampleRate), WAVE_BARS), durationMs: Math.round(buffer.duration * 1000) } : null));
  waves.set(assetId, loading);
  void loading.then((wave) => {
    if (!wave) waves.delete(assetId);
  });
  return loading;
}

export function useSoundWave(assetId: string | null): SoundWave | null {
  const [loaded, setLoaded] = useState<{ assetId: string; wave: SoundWave | null } | null>(null);
  useEffect(() => {
    if (!assetId) return;
    let live = true;
    void soundWave(assetId).then((wave) => {
      if (live) setLoaded({ assetId, wave });
    });
    return () => {
      live = false;
    };
  }, [assetId]);
  return loaded && loaded.assetId === assetId ? loaded.wave : null;
}
