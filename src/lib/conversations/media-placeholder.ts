import { thumbHashToDataURL } from "thumbhash";

const MAX_THUMBHASH_BYTES = 64;

export function placeholderDataUrl(thumbhash: string | null | undefined): string | null {
  if (!thumbhash) return null;
  try {
    const binary = atob(thumbhash);
    if (binary.length === 0 || binary.length > MAX_THUMBHASH_BYTES) return null;
    return thumbHashToDataURL(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  } catch {
    return null;
  }
}
