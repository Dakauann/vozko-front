"use client";

import { useEffect, useRef, useState } from "react";

import { loadMediaFile } from "./media-files";
import { AssetUnavailableError, decodeImageElement, decodePicture, type DecodedPicture } from "./picture-decode";

export { AssetUnavailableError };

const assets = new Map<string, Promise<HTMLImageElement>>();

function decode(src: string, source: string): Promise<HTMLImageElement> {
  return decodeImageElement(src).catch((error: unknown) => {
    throw new AssetUnavailableError(source, error instanceof Error ? error.message : undefined);
  });
}

interface HeldPicture {
  loading: Promise<DecodedPicture>;
  holders: number;
}

const pictures = new Map<string, HeldPicture>();

function closePicture(picture: DecodedPicture): void {
  if ("close" in picture) picture.close();
}

export function acquireAssetPicture(assetId: string): Promise<DecodedPicture> {
  const held = pictures.get(assetId);
  if (held) {
    held.holders += 1;
    return held.loading;
  }
  const loading = loadMediaFile(assetId).then((file) => {
    if (!file || !file.contentType.startsWith("image/")) throw new AssetUnavailableError(assetId, "not an image");
    return decodePicture(file, assetId);
  });
  const entry: HeldPicture = { loading, holders: 1 };
  pictures.set(assetId, entry);
  loading.catch(() => {
    if (pictures.get(assetId) === entry) pictures.delete(assetId);
  });
  return loading;
}

export function releaseAssetPicture(assetId: string): void {
  const held = pictures.get(assetId);
  if (!held) return;
  held.holders -= 1;
  if (held.holders > 0) return;
  pictures.delete(assetId);
  void held.loading.then(closePicture, () => undefined);
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

export async function assetNaturalSize(assetId: string): Promise<{ width: number; height: number }> {
  const image = await loadAssetImage(assetId);
  return { width: image.naturalWidth, height: image.naturalHeight };
}

export function loadUrlImage(src: string): Promise<HTMLImageElement> {
  return decode(src, src);
}

type LoadedImage = { status: "loading" } | { status: "ready"; image: HTMLImageElement } | { status: "failed"; error: Error };

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
