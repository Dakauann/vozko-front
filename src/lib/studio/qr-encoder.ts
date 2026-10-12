export const QR_ECC_LEVELS = ["L", "M", "Q", "H"] as const;

export type QrEcc = (typeof QR_ECC_LEVELS)[number];

export const QR_VERSION_RANGE = [1, 40] as const;

const ECC_PER_BLOCK: Readonly<Record<QrEcc, readonly number[]>> = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};

const BLOCK_COUNT: Readonly<Record<QrEcc, readonly number[]>> = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

const FORMAT_BITS: Readonly<Record<QrEcc, number>> = { L: 1, M: 0, Q: 3, H: 2 };

const BYTE_MODE = 0b0100;
const PAD_BYTES = [0xec, 0x11] as const;
const PENALTY = { run: 3, box: 3, finder: 40, balance: 10 } as const;
const MASKS = 8;

export interface QrSymbol {
  version: number;
  ecc: QrEcc;
  size: number;
  modules: Uint8Array;
  codewords: Int32Array;
  blockOf: Int32Array;
  ecPerBlock: number;
  blocks: number;
}

export function qrSize(version: number): number {
  return version * 4 + 17;
}

function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const aligned = Math.floor(version / 7) + 2;
    result -= (25 * aligned - 10) * aligned - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

export function dataCodewords(version: number, ecc: QrEcc): number {
  return Math.floor(rawDataModules(version) / 8) - ECC_PER_BLOCK[ecc][version] * BLOCK_COUNT[ecc][version];
}

function countBits(version: number): number {
  return version <= 9 ? 8 : 16;
}

export function qrByteCapacity(version: number, ecc: QrEcc): number {
  return Math.floor((dataCodewords(version, ecc) * 8 - 4 - countBits(version)) / 8);
}

export const QR_BYTE_CAPACITY: Readonly<Record<QrEcc, number>> = {
  L: qrByteCapacity(40, "L"),
  M: qrByteCapacity(40, "M"),
  Q: qrByteCapacity(40, "Q"),
  H: qrByteCapacity(40, "H"),
};

export function qrBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function smallestVersion(byteLength: number, ecc: QrEcc, minVersion: number = QR_VERSION_RANGE[0]): number | null {
  for (let version = Math.max(QR_VERSION_RANGE[0], minVersion); version <= QR_VERSION_RANGE[1]; version++) {
    if (byteLength <= qrByteCapacity(version, ecc)) return version;
  }
  return null;
}

function multiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function divisor(degree: number): number[] {
  const result: number[] = Array.from({ length: degree }, (_, i) => (i === degree - 1 ? 1 : 0));
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = multiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = multiply(root, 0x02);
  }
  return result;
}

function remainder(data: readonly number[], by: readonly number[]): number[] {
  const result = by.map(() => 0);
  for (const value of data) {
    const factor = value ^ (result.shift() ?? 0);
    result.push(0);
    by.forEach((coefficient, i) => (result[i] ^= multiply(coefficient, factor)));
  }
  return result;
}

function dataStream(bytes: Uint8Array, version: number, ecc: QrEcc): number[] {
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(BYTE_MODE, 4);
  push(bytes.length, countBits(version));
  bytes.forEach((value) => push(value, 8));
  const capacity = dataCodewords(version, ecc) * 8;
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) codewords.push(bits.slice(i, i + 8).reduce((sum, bit) => (sum << 1) | bit, 0));
  for (let pad = 0; codewords.length < capacity / 8; pad++) codewords.push(PAD_BYTES[pad % 2]);
  return codewords;
}

function interleaved(data: readonly number[], version: number, ecc: QrEcc): { codewords: number[]; blockOf: number[] } {
  const blocks = BLOCK_COUNT[ecc][version];
  const eccLength = ECC_PER_BLOCK[ecc][version];
  const raw = Math.floor(rawDataModules(version) / 8);
  const shortBlocks = blocks - (raw % blocks);
  const shortLength = Math.floor(raw / blocks);
  const by = divisor(eccLength);
  const filled: number[][] = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const chunk = data.slice(k, k + shortLength - eccLength + (i < shortBlocks ? 0 : 1));
    k += chunk.length;
    const check = remainder(chunk, by);
    filled.push([...chunk, ...(i < shortBlocks ? [0] : []), ...check]);
  }
  const codewords: number[] = [];
  const blockOf: number[] = [];
  for (let i = 0; i < filled[0].length; i++) {
    filled.forEach((block, j) => {
      if (i === shortLength - eccLength && j < shortBlocks) return;
      codewords.push(block[i]);
      blockOf.push(j);
    });
  }
  return { codewords, blockOf };
}

export function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
  const result = [6];
  for (let position = qrSize(version) - 7; result.length < count; position -= step) result.splice(1, 0, position);
  return result;
}

class Grid {
  readonly modules: Uint8Array;
  readonly fixed: Uint8Array;

  constructor(readonly size: number) {
    this.modules = new Uint8Array(size * size);
    this.fixed = new Uint8Array(size * size);
  }

  set(x: number, y: number, dark: boolean): void {
    this.modules[y * this.size + x] = dark ? 1 : 0;
    this.fixed[y * this.size + x] = 1;
  }

  dark(x: number, y: number): boolean {
    return this.modules[y * this.size + x] === 1;
  }
}

function drawFinder(grid: Grid, cx: number, cy: number): void {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && x < grid.size && y >= 0 && y < grid.size) grid.set(x, y, distance !== 2 && distance !== 4);
    }
  }
}

function drawAlignment(grid: Grid, cx: number, cy: number): void {
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) grid.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
}

function bit(value: number, index: number): boolean {
  return ((value >>> index) & 1) !== 0;
}

function drawFormat(grid: Grid, ecc: QrEcc, mask: number): void {
  const data = (FORMAT_BITS[ecc] << 3) | mask;
  let rest = data;
  for (let i = 0; i < 10; i++) rest = (rest << 1) ^ ((rest >>> 9) * 0x537);
  const bits = ((data << 10) | rest) ^ 0x5412;
  const size = grid.size;
  for (let i = 0; i <= 5; i++) grid.set(8, i, bit(bits, i));
  grid.set(8, 7, bit(bits, 6));
  grid.set(8, 8, bit(bits, 7));
  grid.set(7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i++) grid.set(14 - i, 8, bit(bits, i));
  for (let i = 0; i < 8; i++) grid.set(size - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i++) grid.set(8, size - 15 + i, bit(bits, i));
  grid.set(8, size - 8, true);
}

function drawVersion(grid: Grid, version: number): void {
  if (version < 7) return;
  let rest = version;
  for (let i = 0; i < 12; i++) rest = (rest << 1) ^ ((rest >>> 11) * 0x1f25);
  const bits = (version << 12) | rest;
  for (let i = 0; i < 18; i++) {
    const a = grid.size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    grid.set(a, b, bit(bits, i));
    grid.set(b, a, bit(bits, i));
  }
}

function drawFunctions(grid: Grid, version: number, ecc: QrEcc): void {
  const size = grid.size;
  for (let i = 0; i < size; i++) {
    grid.set(6, i, i % 2 === 0);
    grid.set(i, 6, i % 2 === 0);
  }
  drawFinder(grid, 3, 3);
  drawFinder(grid, size - 4, 3);
  drawFinder(grid, 3, size - 4);
  const positions = alignmentPositions(version);
  const last = positions.length - 1;
  positions.forEach((y, i) =>
    positions.forEach((x, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      drawAlignment(grid, x, y);
    }),
  );
  drawFormat(grid, ecc, 0);
  drawVersion(grid, version);
}

function drawCodewords(grid: Grid, codewords: readonly number[]): Int32Array {
  const size = grid.size;
  const owner = new Int32Array(size * size).fill(-1);
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vertical : vertical;
        if (grid.fixed[y * size + x] || i >= codewords.length * 8) continue;
        grid.modules[y * size + x] = bit(codewords[i >>> 3], 7 - (i & 7)) ? 1 : 0;
        owner[y * size + x] = i >>> 3;
        i++;
      }
    }
  }
  return owner;
}

function masked(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function applyMask(grid: Grid, mask: number): void {
  for (let y = 0; y < grid.size; y++) {
    for (let x = 0; x < grid.size; x++) {
      const at = y * grid.size + x;
      if (!grid.fixed[at] && masked(mask, x, y)) grid.modules[at] ^= 1;
    }
  }
}

function finderPatterns(history: readonly number[]): number {
  const n = history[1];
  const core = n > 0 && history[2] === n && history[3] === n * 3 && history[4] === n && history[5] === n;
  return (core && history[0] >= n * 4 && history[6] >= n ? 1 : 0) + (core && history[6] >= n * 4 && history[0] >= n ? 1 : 0);
}

function remember(run: number, history: number[], size: number): void {
  history.pop();
  history.unshift(history[0] === 0 ? run + size : run);
}

function linePenalty(size: number, at: (i: number) => boolean): number {
  let result = 0;
  let color = false;
  let run = 0;
  const history = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < size; i++) {
    if (at(i) === color) {
      run++;
      if (run === 5) result += PENALTY.run;
      else if (run > 5) result++;
      continue;
    }
    remember(run, history, size);
    if (!color) result += finderPatterns(history) * PENALTY.finder;
    color = at(i);
    run = 1;
  }
  if (color) {
    remember(run, history, size);
    run = 0;
  }
  remember(run + size, history, size);
  return result + finderPatterns(history) * PENALTY.finder;
}

function penalty(grid: Grid): number {
  const size = grid.size;
  let result = 0;
  for (let y = 0; y < size; y++) result += linePenalty(size, (x) => grid.dark(x, y));
  for (let x = 0; x < size; x++) result += linePenalty(size, (y) => grid.dark(x, y));
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const color = grid.dark(x, y);
      if (color === grid.dark(x + 1, y) && color === grid.dark(x, y + 1) && color === grid.dark(x + 1, y + 1)) result += PENALTY.box;
    }
  }
  const dark = grid.modules.reduce((sum, value) => sum + value, 0);
  const total = size * size;
  return result + (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * PENALTY.balance;
}

export function encodeQrVersion(text: string, ecc: QrEcc, version: number): QrSymbol | null {
  const bytes = qrBytes(text);
  if (version < QR_VERSION_RANGE[0] || version > QR_VERSION_RANGE[1] || bytes.length > qrByteCapacity(version, ecc)) return null;
  const { codewords, blockOf } = interleaved(dataStream(bytes, version, ecc), version, ecc);
  const grid = new Grid(qrSize(version));
  drawFunctions(grid, version, ecc);
  const owner = drawCodewords(grid, codewords);
  let best = 0;
  let lowest = Infinity;
  for (let mask = 0; mask < MASKS; mask++) {
    applyMask(grid, mask);
    drawFormat(grid, ecc, mask);
    const score = penalty(grid);
    if (score < lowest) {
      lowest = score;
      best = mask;
    }
    applyMask(grid, mask);
  }
  applyMask(grid, best);
  drawFormat(grid, ecc, best);
  return { version, ecc, size: grid.size, modules: grid.modules, codewords: owner, blockOf: Int32Array.from(blockOf), ecPerBlock: ECC_PER_BLOCK[ecc][version], blocks: BLOCK_COUNT[ecc][version] };
}

export function encodeQr(text: string, ecc: QrEcc, minVersion: number = QR_VERSION_RANGE[0]): QrSymbol | null {
  const version = smallestVersion(qrBytes(text).length, ecc, minVersion);
  return version === null ? null : encodeQrVersion(text, ecc, version);
}

export function isDark(symbol: QrSymbol, x: number, y: number): boolean {
  return symbol.modules[y * symbol.size + x] === 1;
}
