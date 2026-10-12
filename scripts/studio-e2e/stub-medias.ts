const FILES: Record<string, { file: string; type: string }> = {
  swatch: { file: "swatch.png", type: "image/png" },
  "green-screen": { file: "green-screen.png", type: "image/png" },
  clip: { file: "clip.mp4", type: "video/mp4" },
  tone: { file: "tone.m4a", type: "audio/mp4" },
};

function media(id: string) {
  const url = `/fixtures/${FILES[id].file}`;
  return { id, description: id, url, previewUrl: url, createdAt: "2026-10-10T00:00:00Z", type: FILES[id].type };
}

export async function getMediaAction(mediaId: string) {
  return FILES[mediaId] ? media(mediaId) : null;
}

export async function listLibraryAction() {
  return { data: Object.keys(FILES).map(media) };
}

export async function listMediasAction() {
  return { medias: Object.keys(FILES).map(media) };
}

export async function uploadMediaAction() {
  return { mediaId: "swatch", mediaUrl: "/fixtures/swatch.png", mediaPreviewUrl: "/fixtures/swatch.png" };
}

export async function fetchMediaFileAction(mediaId: string) {
  if (!FILES[mediaId]) return { data: null, error: "missing" };
  const response = await fetch(`/fixtures/${FILES[mediaId].file}`);
  if (!response.ok) return { data: null, error: "missing" };
  const blob = await response.blob();
  return { data: { blob, contentType: response.headers.get("content-type") ?? blob.type }, error: null };
}
