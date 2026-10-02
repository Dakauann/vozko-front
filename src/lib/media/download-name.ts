const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const ACCENTS = /[̀-ͯ]/g;
const MAX_SLUG = 60;
const FALLBACK = "imagem";

function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(ACCENTS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_SLUG)
    .replace(/^-+|-+$/g, "");
}

export function mediaDownloadName(description: string, contentType: string): string {
  const mime = contentType.split(";")[0].trim().toLowerCase();
  return `${slug(description) || FALLBACK}${EXTENSIONS[mime] ?? ""}`;
}
