const UPLOADABLE_TYPES = ["image/png", "image/jpeg"];

export function isUploadableImage(file: File): boolean {
  return UPLOADABLE_TYPES.includes(file.type);
}

export async function asUploadableImage(file: File): Promise<File | null> {
  if (isUploadableImage(file)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return null;
    const base = file.name.replace(/\.[^.]+$/, "") || "imagem";
    return new File([blob], `${base}.png`, { type: "image/png" });
  } catch {
    return null;
  }
}
