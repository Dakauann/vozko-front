"use client";

import { useSyncExternalStore } from "react";

import { loadMediaFile } from "@/components/studio/canvas/media-files";

const PREVIEW_VOLUME = 0.8;

let element: HTMLAudioElement | null = null;
let playing: string | null = null;
let turn = 0;
const listeners = new Set<() => void>();

function announce(next: string | null): void {
  if (playing === next) return;
  playing = next;
  for (const listener of listeners) listener();
}

function silence(): void {
  element?.pause();
  element = null;
}

export function playingSound(): string | null {
  return playing;
}

export function playPreview(assetId: string): void {
  turn += 1;
  const mine = turn;
  silence();
  announce(assetId);
  void loadMediaFile(assetId).then((file) => {
    if (mine !== turn) return;
    if (!file) {
      announce(null);
      return;
    }
    const audio = new Audio(file.url);
    audio.volume = PREVIEW_VOLUME;
    audio.onended = () => {
      if (mine === turn) announce(null);
    };
    element = audio;
    audio.play().catch(() => {
      if (mine === turn) announce(null);
    });
  });
}

export function stopPreview(): void {
  turn += 1;
  silence();
  announce(null);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePlayingSound(): string | null {
  return useSyncExternalStore(subscribe, playingSound, () => null);
}
