export interface LumaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

const RED = 13933;
const GREEN = 46871;
const BLUE = 4732;
const HALF = 32768;

export function lumaOfRgba(rgba: Uint8ClampedArray, width: number, height: number, into?: Uint8Array): LumaImage {
  const count = width * height;
  const data = into && into.length === count ? into : new Uint8Array(count);
  for (let i = 0, j = 0; i < count; i++, j += 4) data[i] = (RED * rgba[j] + GREEN * rgba[j + 1] + BLUE * rgba[j + 2] + HALF) >> 16;
  return { width, height, data };
}

export function lumaAt(image: LumaImage, x: number, y: number): number {
  const cx = x < 0 ? 0 : x >= image.width ? image.width - 1 : x;
  const cy = y < 0 ? 0 : y >= image.height ? image.height - 1 : y;
  return image.data[cy * image.width + cx];
}
