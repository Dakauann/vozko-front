export interface ZipFile {
  name: string;
  data: Uint8Array;
}

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_DIRECTORY = 0x06054b50;
const VERSION = 20;
const UTF8_NAMES = 0x0800;
const DOS_DATE_1980 = 0x21;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function uniqueNames(names: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    if (count === 1) return name;
    const dot = name.lastIndexOf(".");
    return dot > 0 ? `${name.slice(0, dot)}-${count}${name.slice(dot)}` : `${name}-${count}`;
  });
}

export function zipStore(files: readonly ZipFile[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const entries = files.map((file) => ({ name: encoder.encode(file.name), data: file.data, crc: crc32(file.data) }));
  const localSize = entries.reduce((sum, e) => sum + 30 + e.name.length + e.data.length, 0);
  const centralSize = entries.reduce((sum, e) => sum + 46 + e.name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  const offsets: number[] = [];
  let at = 0;
  const shared = (base: number, entry: (typeof entries)[number]) => {
    view.setUint16(base, VERSION, true);
    view.setUint16(base + 2, UTF8_NAMES, true);
    view.setUint16(base + 4, 0, true);
    view.setUint16(base + 6, 0, true);
    view.setUint16(base + 8, DOS_DATE_1980, true);
    view.setUint32(base + 10, entry.crc, true);
    view.setUint32(base + 14, entry.data.length, true);
    view.setUint32(base + 18, entry.data.length, true);
    view.setUint16(base + 22, entry.name.length, true);
    view.setUint16(base + 24, 0, true);
  };
  for (const entry of entries) {
    offsets.push(at);
    view.setUint32(at, LOCAL_HEADER, true);
    shared(at + 4, entry);
    out.set(entry.name, at + 30);
    out.set(entry.data, at + 30 + entry.name.length);
    at += 30 + entry.name.length + entry.data.length;
  }
  const centralStart = at;
  entries.forEach((entry, i) => {
    view.setUint32(at, CENTRAL_HEADER, true);
    view.setUint16(at + 4, VERSION, true);
    shared(at + 6, entry);
    view.setUint16(at + 32, 0, true);
    view.setUint16(at + 34, 0, true);
    view.setUint16(at + 36, 0, true);
    view.setUint32(at + 38, 0, true);
    view.setUint32(at + 42, offsets[i], true);
    out.set(entry.name, at + 46);
    at += 46 + entry.name.length;
  });
  view.setUint32(at, END_OF_DIRECTORY, true);
  view.setUint16(at + 8, entries.length, true);
  view.setUint16(at + 10, entries.length, true);
  view.setUint32(at + 12, at - centralStart, true);
  view.setUint32(at + 16, centralStart, true);
  return out;
}
