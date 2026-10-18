"use client";

import { useEffect, useSyncExternalStore } from "react";

import { levelsOf, reactAssetIds, reactKey, spectrumAssetIds } from "@/lib/studio/audio-react";
import { spectrumProfile, type SpectrumProfile } from "@/lib/studio/audio-spectrum";
import { NO_LEVELS, type TrackLevels } from "@/lib/studio/behaviors";
import type { VideoDocument } from "@/lib/studio/document";
import { loudnessProfile, type LoudnessProfile } from "@/lib/studio/loudness";

import { decodeAudioFile, PREVIEW_SAMPLE_RATE } from "./audio-graph";
import { channelsOf } from "./export/audio-mixdown";

type ProfileLoader = (assetId: string) => Promise<LoudnessProfile | null>;

type SpectrumLoader = (assetId: string) => Promise<SpectrumProfile | null>;

async function decodedProfile(assetId: string): Promise<LoudnessProfile | null> {
  const buffer = await decodeAudioFile(assetId, PREVIEW_SAMPLE_RATE);
  return buffer ? loudnessProfile(channelsOf(buffer), buffer.sampleRate) : null;
}

async function decodedSpectrum(assetId: string): Promise<SpectrumProfile | null> {
  const buffer = await decodeAudioFile(assetId, PREVIEW_SAMPLE_RATE);
  return buffer ? spectrumProfile(channelsOf(buffer), buffer.sampleRate) : null;
}

class AssetCache<T> {
  private loading = new Map<string, Promise<T | null>>();
  readonly loaded = new Map<string, T>();
  private failed = new Set<string>();

  constructor(private readonly load: (assetId: string) => Promise<T | null>) {}

  has(assetId: string): boolean {
    return this.loading.has(assetId);
  }

  get(assetId: string, retry: boolean): Promise<T | null> {
    const known = this.loading.get(assetId);
    if (known && !(retry && this.failed.has(assetId))) return known;
    this.failed.delete(assetId);
    const loading = this.load(assetId).then((value) => {
      if (value) this.loaded.set(assetId, value);
      else this.failed.add(assetId);
      return value;
    });
    this.loading.set(assetId, loading);
    return loading;
  }
}

class ReactLevels {
  private readonly profiles: AssetCache<LoudnessProfile>;
  private readonly spectra: AssetCache<SpectrumProfile>;
  private memo: { key: string; levels: TrackLevels } | null = null;
  private listeners = new Set<() => void>();

  constructor(load: ProfileLoader = decodedProfile, loadSpectrum: SpectrumLoader = decodedSpectrum) {
    this.profiles = new AssetCache(load);
    this.spectra = new AssetCache(loadSpectrum);
  }

  current(doc: VideoDocument): TrackLevels {
    const heard = reactKey(doc);
    if (heard === "") return NO_LEVELS;
    const key = `${heard}|${this.profiles.loaded.size}|${this.spectra.loaded.size}`;
    if (this.memo?.key === key) return this.memo.levels;
    const levels = levelsOf(doc, (assetId) => this.profiles.loaded.get(assetId), (assetId) => this.spectra.loaded.get(assetId));
    if (!levels) return NO_LEVELS;
    this.memo = { key, levels };
    return levels;
  }

  request(doc: VideoDocument): void {
    const profiles = reactAssetIds(doc).filter((assetId) => !this.profiles.has(assetId));
    const spectra = spectrumAssetIds(doc).filter((assetId) => !this.spectra.has(assetId));
    if (profiles.length === 0 && spectra.length === 0) return;
    void Promise.all([...profiles.map((assetId) => this.profiles.get(assetId, false)), ...spectra.map((assetId) => this.spectra.get(assetId, false))]).then((loaded) => {
      if (loaded.some((value) => value !== null)) this.notify();
    });
  }

  async preload(assetIds: readonly string[]): Promise<void> {
    await Promise.all(assetIds.map((assetId) => this.profiles.get(assetId, true)));
  }

  async ready(doc: VideoDocument): Promise<TrackLevels | null> {
    const loaded = await Promise.all([...reactAssetIds(doc).map((assetId) => this.profiles.get(assetId, true)), ...spectrumAssetIds(doc).map((assetId) => this.spectra.get(assetId, true))]);
    if (loaded.some((value) => value === null)) return null;
    return this.current(doc);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export const reactLevels = new ReactLevels();

export function useReactLevels(doc: VideoDocument): TrackLevels {
  useEffect(() => reactLevels.request(doc), [doc]);
  return useSyncExternalStore(
    (listener) => reactLevels.subscribe(listener),
    () => reactLevels.current(doc),
    () => NO_LEVELS,
  );
}
