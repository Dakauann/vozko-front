import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { readZip } from "./zip";

const FIXTURES = join(process.cwd(), "..", "vozko-back", "domain", "studio", "testdata", "lottie");

function storedZip(files: Record<string, string>): Uint8Array {
  const encoder = new TextEncoder();
  const locals: number[] = [];
  const central: number[] = [];
  const u16 = (out: number[], value: number) => out.push(value & 0xff, (value >> 8) & 0xff);
  const u32 = (out: number[], value: number) => out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff);
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const body = encoder.encode(text);
    const offset = locals.length;
    u32(locals, 0x04034b50);
    [20, 0, 0, 0, 0].forEach((value) => u16(locals, value));
    u32(locals, 0);
    u32(locals, body.length);
    u32(locals, body.length);
    u16(locals, nameBytes.length);
    u16(locals, 0);
    locals.push(...nameBytes, ...body);
    u32(central, 0x02014b50);
    [20, 20, 0, 0, 0, 0].forEach((value) => u16(central, value));
    u32(central, 0);
    u32(central, body.length);
    u32(central, body.length);
    [nameBytes.length, 0, 0, 0, 0].forEach((value) => u16(central, value));
    u32(central, 0);
    u32(central, offset);
    central.push(...nameBytes);
  }
  const end: number[] = [];
  u32(end, 0x06054b50);
  [0, 0, Object.keys(files).length, Object.keys(files).length].forEach((value) => u16(end, value));
  u32(end, central.length);
  u32(end, locals.length);
  u16(end, 0);
  return new Uint8Array([...locals, ...central, ...end]);
}

describe("zip reader for dotLottie files", () => {
  it("reads deflated entries of a real dotLottie file", async () => {
    const zip = readZip(new Uint8Array(readFileSync(join(FIXTURES, "static-shapes.lottie"))));
    if (!zip) throw new Error("the fixture did not open");
    expect(zip.names().sort()).toEqual(["animations/formas.json", "manifest.json"]);
    const manifest = JSON.parse((await zip.text("manifest.json"))!);
    expect(manifest.animations[0].id).toBe("formas");
    const animation = JSON.parse((await zip.text("animations/formas.json"))!);
    expect(animation.layers).toHaveLength(1);
  });

  it("reads stored entries and answers null for a missing one", async () => {
    const zip = readZip(storedZip({ "manifest.json": '{"animations":[{"id":"a"}]}', "a/a.json": "{}" }))!;
    expect(await zip.text("a/a.json")).toBe("{}");
    expect(await zip.text("nope.json")).toBeNull();
  });

  it("refuses bytes that are not a zip or are cut short", () => {
    expect(readZip(new TextEncoder().encode('{"v":"5"}'))).toBeNull();
    const whole = storedZip({ "manifest.json": "{}" });
    expect(readZip(whole.slice(0, whole.length - 10))).toBeNull();
  });
});
