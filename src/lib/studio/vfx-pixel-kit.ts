export interface VfxFrame {
  left: number;
  top: number;
  width: number;
  height: number;
  unitsWide: number;
  unitsHigh: number;
}

export type Rgb = [number, number, number];

export const LUMA: Rgb = [0.2126, 0.7152, 0.0722];

export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface Place {
  u: number;
  v: number;
  px: number;
  py: number;
}

function unit(value: number): number {
  return value <= 0 ? 0 : value >= 1 ? 1 : value;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = unit((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function eachPixel(pixels: Pixels, frame: VfxFrame, visit: (index: number, place: Place) => void): void {
  for (let y = 0; y < pixels.height; y++) {
    const v = (y + 0.5 - frame.top) / frame.height;
    for (let x = 0; x < pixels.width; x++) {
      const u = (x + 0.5 - frame.left) / frame.width;
      visit((y * pixels.width + x) * 4, { u, v, px: u * frame.unitsWide, py: v * frame.unitsHigh });
    }
  }
}

export function tone(pixels: Pixels, frame: VfxFrame, shade: (color: Rgb, place: Place) => Rgb): void {
  const { data } = pixels;
  eachPixel(pixels, frame, (i, place) => {
    if (data[i + 3] === 0) return;
    const color = shade([data[i] / 255, data[i + 1] / 255, data[i + 2] / 255], place);
    data[i] = unit(color[0]) * 255;
    data[i + 1] = unit(color[1]) * 255;
    data[i + 2] = unit(color[2]) * 255;
  });
}

export function premultiplied(source: Uint8ClampedArray, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height * 4);
  for (let i = 0; i < out.length; i += 4) {
    const alpha = source[i + 3] / 255;
    out[i] = (source[i] / 255) * alpha;
    out[i + 1] = (source[i + 1] / 255) * alpha;
    out[i + 2] = (source[i + 2] / 255) * alpha;
    out[i + 3] = alpha;
  }
  return out;
}

type Sample = (u: number, v: number, out: Float32Array) => void;

export function sampleFrom(source: Float32Array, width: number, height: number, frame: VfxFrame): Sample {
  return (u, v, out) => {
    const x = Math.min(width - 1, Math.max(0, frame.left + u * frame.width - 0.5));
    const y = Math.min(height - 1, Math.max(0, frame.top + v * frame.height - 0.5));
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);
    const fx = x - x0;
    const fy = y - y0;
    for (let c = 0; c < 4; c++) {
      const top = source[(y0 * width + x0) * 4 + c] * (1 - fx) + source[(y0 * width + x1) * 4 + c] * fx;
      const bottom = source[(y1 * width + x0) * 4 + c] * (1 - fx) + source[(y1 * width + x1) * 4 + c] * fx;
      out[c] = top * (1 - fy) + bottom * fy;
    }
  };
}

export function sampler(pixels: Pixels, frame: VfxFrame): Sample {
  return sampleFrom(premultiplied(pixels.data, pixels.width, pixels.height), pixels.width, pixels.height, frame);
}

export function writePremultiplied(data: Uint8ClampedArray, i: number, r: number, g: number, b: number, alpha: number): void {
  const a = unit(alpha);
  data[i + 3] = a * 255;
  if (a <= 0) {
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    return;
  }
  data[i] = unit(r / a) * 255;
  data[i + 1] = unit(g / a) * 255;
  data[i + 2] = unit(b / a) * 255;
}

export function screen(base: Rgb, light: Rgb): Rgb {
  return [0, 1, 2].map((c) => 1 - (1 - base[c]) * (1 - unit(light[c]))) as Rgb;
}

export function mixInto(data: Uint8ClampedArray, i: number, original: Float32Array, result: Float32Array, weight: number): void {
  writePremultiplied(
    data,
    i,
    original[i] + (result[0] - original[i]) * weight,
    original[i + 1] + (result[1] - original[i + 1]) * weight,
    original[i + 2] + (result[2] - original[i + 2]) * weight,
    original[i + 3] + (result[3] - original[i + 3]) * weight,
  );
}
