export async function fetchMediaFileAction(mediaId: string) {
  const response = await fetch(`/fixtures/${encodeURIComponent(mediaId)}`);
  if (!response.ok) return { data: null, error: "missing" };
  const blob = await response.blob();
  return { data: { blob, contentType: response.headers.get("content-type") ?? blob.type }, error: null };
}

export async function getMediaAction() {
  return null;
}

export async function listLibraryAction() {
  return { data: [] };
}

export async function uploadMediaAction() {
  return { error: "harness", code: "harness" };
}
