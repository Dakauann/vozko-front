"use client";

import { useEffect, useRef, useState } from "react";

import { loadMediaFile } from "./media-files";

export class AssetUnavailableError extends Error {
  constructor(readonly source: string) {
    super(`studio asset ${source} could not be loaded`);
  }
}

const assets = new Map<string, Promise<HTMLImageElement>>();

function decode(src: string, source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new AssetUnavailableError(source));
    image.src = src;
  });
}

export function loadAssetImage(assetId: string): Promise<HTMLImageElement> {
  const cached = assets.get(assetId);
  if (cached) return cached;
  const loading = loadMediaFile(assetId).then((file) => {
    if (!file || !file.contentType.startsWith("image/")) throw new AssetUnavailableError(assetId);
    return decode(file.url, assetId);
  });
  assets.set(assetId, loading);
  loading.catch(() => assets.delete(assetId));
  return loading;
}

export function loadUrlImage(src: string): Promise<HTMLImageElement> {
  return decode(src, src);
}

export type LoadedImage = { status: "loading" } | { status: "ready"; image: HTMLImageElement } | { status: "failed"; error: Error };

export function useLoadedImage(key: string | null, load: (key: string) => Promise<HTMLImageElement>): LoadedImage {
  const [state, setState] = useState<{ key: string | null; value: LoadedImage }>({ key: null, value: { status: "loading" } });
  const loader = useRef(load);

  useEffect(() => {
    loader.current = load;
  }, [load]);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    loader.current(key).then(
      (image) => !cancelled && setState({ key, value: { status: "ready", image } }),
      (error: unknown) => !cancelled && setState({ key, value: { status: "failed", error: error instanceof Error ? error : new AssetUnavailableError(key) } }),
    );
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (key === null) return { status: "failed", error: new AssetUnavailableError("") };
  return state.key === key ? state.value : { status: "loading" };
}
