const END_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const END_SIZE = 22;
const MAX_COMMENT = 0xffff;
const CENTRAL_SIZE = 46;
const LOCAL_SIZE = 30;
const STORED = 0;
const DEFLATED = 8;
const ENCRYPTED = 1;
const ZIP64_MARK = 0xffffffff;
const MAX_ENTRY_BYTES = 64 * 1024 * 1024;

interface Entry {
  method: number;
  compressed: number;
  size: number;
  start: number;
}

export interface ZipArchive {
  names: () => string[];
  bytes: (name: string) => Promise<Uint8Array | null>;
  text: (name: string) => Promise<string | null>;
}

function endOffset(view: DataView): number {
  const lowest = Math.max(0, view.byteLength - END_SIZE - MAX_COMMENT);
  for (let at = view.byteLength - END_SIZE; at >= lowest; at--) if (view.getUint32(at, true) === END_SIGNATURE) return at;
  return -1;
}

function entriesOf(bytes: Uint8Array): Map<string, Entry> | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < END_SIZE) return null;
  const end = endOffset(view);
  if (end < 0) return null;
  const count = view.getUint16(end + 10, true);
  const size = view.getUint32(end + 12, true);
  const offset = view.getUint32(end + 16, true);
  if (offset + size > end) return null;
  const decoder = new TextDecoder();
  const entries = new Map<string, Entry>();
  let at = offset;
  for (let i = 0; i < count; i++) {
    if (at + CENTRAL_SIZE > end || view.getUint32(at, true) !== CENTRAL_SIGNATURE) return null;
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const compressed = view.getUint32(at + 20, true);
    const length = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const skip = view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    if ((flags & ENCRYPTED) !== 0 || compressed === ZIP64_MARK || length === ZIP64_MARK || length > MAX_ENTRY_BYTES) return null;
    const name = decoder.decode(bytes.subarray(at + CENTRAL_SIZE, at + CENTRAL_SIZE + nameLength));
    if (local + LOCAL_SIZE > bytes.byteLength || view.getUint32(local, true) !== LOCAL_SIGNATURE) return null;
    const start = local + LOCAL_SIZE + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (start + compressed > bytes.byteLength) return null;
    entries.set(name, { method, compressed, size: length, start });
    at += CENTRAL_SIZE + nameLength + skip;
  }
  return entries;
}

async function inflated(data: Uint8Array, size: number): Promise<Uint8Array | null> {
  try {
    const source = new ReadableStream<Uint8Array>({
      start: (controller) => {
        controller.enqueue(data.slice());
        controller.close();
      },
    });
    const stream = source.pipeThrough(new DecompressionStream("deflate-raw") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
    const out = new Uint8Array(await new Response(stream).arrayBuffer());
    return out.byteLength === size ? out : null;
  } catch {
    return null;
  }
}

export function readZip(bytes: Uint8Array): ZipArchive | null {
  const entries = entriesOf(bytes);
  if (!entries) return null;
  const read = async (name: string): Promise<Uint8Array | null> => {
    const entry = entries.get(name);
    if (!entry) return null;
    const data = bytes.subarray(entry.start, entry.start + entry.compressed);
    if (entry.method === STORED) return entry.compressed === entry.size ? data : null;
    return entry.method === DEFLATED ? inflated(data, entry.size) : null;
  };
  return {
    names: () => [...entries.keys()],
    bytes: read,
    text: async (name) => {
      const data = await read(name);
      return data ? new TextDecoder().decode(data) : null;
    },
  };
}
