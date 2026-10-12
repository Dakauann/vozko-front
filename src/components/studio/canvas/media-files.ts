"use client";

import { fetchMediaFileAction, type MediaFile } from "@/app/actions/medias";
import { builtinSound, isSoundAsset } from "@/lib/studio/builtin-sounds";

export interface LoadedMediaFile {
  blob: Blob;
  contentType: string;
  url: string;
}

const files = new Map<string, Promise<LoadedMediaFile | null>>();

async function appFile(file: string): Promise<MediaFile | null> {
  const response = await fetch(file);
  if (!response.ok) return null;
  const blob = await response.blob();
  return { blob, contentType: response.headers.get("content-type") ?? blob.type };
}

function download(assetId: string): Promise<MediaFile | null> {
  if (!isSoundAsset(assetId)) return fetchMediaFileAction(assetId).then(({ data }) => data);
  const sound = builtinSound(assetId);
  return sound ? appFile(sound.file) : Promise.resolve(null);
}

export function loadMediaFile(assetId: string): Promise<LoadedMediaFile | null> {
  const cached = files.get(assetId);
  if (cached) return cached;
  const loading = download(assetId).then(
    (data) => (data ? { blob: data.blob, contentType: data.contentType, url: URL.createObjectURL(data.blob) } : null),
    () => null,
  );
  files.set(assetId, loading);
  void loading.then((file) => {
    if (!file) files.delete(assetId);
  });
  return loading;
}
