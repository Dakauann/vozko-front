export class AssetUnavailableError extends Error {
  constructor(
    readonly source: string,
    readonly reason: string = "unavailable",
  ) {
    super(`studio asset ${source} could not be loaded: ${reason}`);
  }
}

export type DecodedPicture = ImageBitmap | HTMLImageElement;

export interface PictureDecoders {
  bitmap: ((blob: Blob, options: ImageBitmapOptions) => Promise<ImageBitmap>) | null;
  element: (url: string) => Promise<HTMLImageElement>;
}

export const PICTURE_DECODE_OPTIONS: ImageBitmapOptions = { imageOrientation: "from-image", premultiplyAlpha: "premultiply", colorSpaceConversion: "default" };

export function decodeImageElement(url: string): Promise<HTMLImageElement> {
  const image = new window.Image();
  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image element could not decode"));
  });
  image.src = url;
  if (typeof image.decode !== "function") return loaded;
  return image.decode().then(
    () => image,
    () => loaded,
  );
}

export function pictureDecoders(): PictureDecoders {
  const create = typeof createImageBitmap === "function" ? createImageBitmap : null;
  return { bitmap: create ? (blob, options) => create(blob, options) : null, element: decodeImageElement };
}

function reasonOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "decode failed";
}

export async function decodePicture(file: { blob: Blob; url: string }, source: string, decoders: PictureDecoders = pictureDecoders()): Promise<DecodedPicture> {
  if (decoders.bitmap) {
    const bitmap = await decoders.bitmap(file.blob, PICTURE_DECODE_OPTIONS).catch(() => null);
    if (bitmap) return bitmap;
  }
  return decoders.element(file.url).catch((error: unknown) => {
    throw new AssetUnavailableError(source, reasonOf(error));
  });
}
