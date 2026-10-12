import { HEAVY_ASSETS, type HeavyAsset } from "../heavy-document";

function asset(id: string) {
  return id in HEAVY_ASSETS ? HEAVY_ASSETS[id as HeavyAsset] : null;
}

function media(id: HeavyAsset) {
  const url = `/fixtures/${HEAVY_ASSETS[id].file}`;
  return { id, description: id, url, previewUrl: url, createdAt: "2026-10-11T00:00:00Z", type: HEAVY_ASSETS[id].type };
}

export async function getMediaAction(mediaId: string) {
  return asset(mediaId) ? media(mediaId as HeavyAsset) : null;
}

export async function listLibraryAction() {
  return { data: (Object.keys(HEAVY_ASSETS) as HeavyAsset[]).map(media) };
}

export async function listMediasAction() {
  return { medias: (Object.keys(HEAVY_ASSETS) as HeavyAsset[]).map(media) };
}

export async function uploadMediaAction() {
  return { error: "harness", code: "harness" };
}

export async function fetchMediaFileAction(mediaId: string) {
  const found = asset(mediaId);
  const response = found ? await fetch(`/fixtures/${found.file}`) : null;
  if (!response?.ok) return { data: null, error: "missing" };
  const blob = await response.blob();
  return { data: { blob, contentType: response.headers.get("content-type") ?? blob.type }, error: null };
}
