import type { ActionResult } from "@/app/actions/action-result";
import { uploadMediaAction } from "@/app/actions/medias";

type LibraryMediaType = "image" | "video";

export interface UploadedMedia {
  mediaId: string;
  mediaUrl: string;
}

const FALLBACK_CONTENT_TYPES: Record<LibraryMediaType, string> = { image: "image/png", video: "video/mp4" };

export async function uploadLibraryMedia(blob: Blob, mediaType: LibraryMediaType, description: string, fileName: string): Promise<ActionResult<UploadedMedia>> {
  const form = new FormData();
  form.append("media", new File([blob], fileName, { type: blob.type || FALLBACK_CONTENT_TYPES[mediaType] }));
  form.append("mediaType", mediaType);
  form.append("description", description);
  const result = await uploadMediaAction(form);
  if (result.error || !result.mediaId || !result.mediaUrl) return { error: result.error ?? "Upload returned no media" };
  return { data: { mediaId: result.mediaId, mediaUrl: result.mediaUrl } };
}
