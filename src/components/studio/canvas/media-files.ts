"use client";

import { fetchMediaFileAction } from "@/app/actions/medias";

export interface LoadedMediaFile {
  blob: Blob;
  contentType: string;
  url: string;
}

const files = new Map<string, Promise<LoadedMediaFile | null>>();

export function loadMediaFile(assetId: string): Promise<LoadedMediaFile | null> {
  const cached = files.get(assetId);
  if (cached) return cached;
  const loading = fetchMediaFileAction(assetId).then(
    ({ data }) => (data ? { blob: data.blob, contentType: data.contentType, url: URL.createObjectURL(data.blob) } : null),
    () => null,
  );
  files.set(assetId, loading);
  void loading.then((file) => {
    if (!file) files.delete(assetId);
  });
  return loading;
}
