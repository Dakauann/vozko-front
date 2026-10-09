import type { Filters } from "../document";

export type ColorMatrix = number[];

const IDENTITY: ColorMatrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

function multiply(outer: ColorMatrix, inner: ColorMatrix): ColorMatrix {
  const result = new Array<number>(20).fill(0);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      let sum = col === 4 ? outer[row * 5 + 4] : 0;
      for (let k = 0; k < 4; k++) sum += outer[row * 5 + k] * inner[k * 5 + col];
      result[row * 5 + col] = sum;
    }
  }
  return result;
}

function brighten(amount: number): ColorMatrix {
  return [1, 0, 0, 0, amount, 0, 1, 0, 0, amount, 0, 0, 1, 0, amount, 0, 0, 0, 1, 0];
}

function contrast(amount: number): ColorMatrix {
  const k = ((amount + 100) / 100) ** 2;
  const offset = 0.5 * (1 - k);
  return [k, 0, 0, 0, offset, 0, k, 0, 0, offset, 0, 0, k, 0, offset, 0, 0, 0, 1, 0];
}

function saturate(amount: number): ColorMatrix {
  const s = 2 ** amount;
  return [
    0.299 + 0.701 * s, 0.587 - 0.587 * s, 0.114 - 0.114 * s, 0, 0,
    0.299 - 0.299 * s, 0.587 + 0.413 * s, 0.114 - 0.114 * s, 0, 0,
    0.299 - 0.3 * s, 0.587 - 0.588 * s, 0.114 + 0.886 * s, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

export function filterMatrix(filters: Filters | undefined): ColorMatrix | null {
  if (!filters || (filters.brightness === 0 && filters.contrast === 0 && filters.saturation === 0)) return null;
  let matrix = IDENTITY;
  if (filters.brightness !== 0) matrix = multiply(brighten(filters.brightness), matrix);
  if (filters.contrast !== 0) matrix = multiply(contrast(filters.contrast), matrix);
  if (filters.saturation !== 0) matrix = multiply(saturate(filters.saturation), matrix);
  return matrix;
}

export function applyMatrix(matrix: ColorMatrix, [r, g, b]: [number, number, number]): [number, number, number] {
  const channel = (row: number) => matrix[row * 5] * r + matrix[row * 5 + 1] * g + matrix[row * 5 + 2] * b + matrix[row * 5 + 4];
  return [channel(0), channel(1), channel(2)];
}
