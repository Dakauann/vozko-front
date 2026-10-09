import { describe, expect, it } from "vitest";

import { crc32, uniqueNames, zipStore } from "./zip";

function readEntries(zip: Uint8Array): { name: string; data: string; crc: number }[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.byteLength - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const entries = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLength));
    const localName = view.getUint16(local + 26, true);
    const start = local + 30 + localName;
    entries.push({ name, data: new TextDecoder().decode(zip.subarray(start, start + size)), crc });
    at += 46 + nameLength;
  }
  return entries;
}

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("packs files uncompressed with names and checksums any unzip tool reads", () => {
    const files = [
      { name: "1-feed.png", data: new TextEncoder().encode("feed") },
      { name: "2-story.png", data: new TextEncoder().encode("story pixels") },
    ];
    const entries = readEntries(zipStore(files));
    expect(entries).toEqual([
      { name: "1-feed.png", data: "feed", crc: crc32(files[0].data) },
      { name: "2-story.png", data: "story pixels", crc: crc32(files[1].data) },
    ]);
  });

  it("keeps file names unique inside the archive", () => {
    expect(uniqueNames(["a.png", "b.png", "a.png", "a.png"])).toEqual(["a.png", "b.png", "a-2.png", "a-3.png"]);
  });
});
