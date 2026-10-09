export async function fetchMediaFileAction(id: string) {
  const response = await fetch(`/fixtures/${id}`);
  if (!response.ok) return { error: "missing" };
  const blob = await response.blob();
  return { data: { blob, contentType: response.headers.get("content-type") ?? blob.type } };
}

export async function uploadMediaAction() {
  return { mediaId: "parity", mediaUrl: "blob:parity" };
}
