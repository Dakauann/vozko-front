import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BUILTIN_SOUNDS, builtinSound, SOUND_FIXTURE_PATH, soundAssetId, soundAssetIssue, soundFixture } from "./builtin-sounds";
import { emptyVideoDocument, newMediaClip, type VideoDocument } from "./document";
import { parseDocument } from "./validate";

const PUBLIC = join(process.cwd(), "public");
const ROOT = join(process.cwd(), "..");
const BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const RATES = [44100, 48000, 32000];
const SAMPLES_PER_FRAME = 1152;
const DURATION_TOLERANCE_MS = 60;

function id3Size(bytes: Uint8Array): number {
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return 0;
  return 10 + ((bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9]);
}

function mp3DurationMs(bytes: Uint8Array): number {
  let at = id3Size(bytes);
  let frames = 0;
  let rate = 0;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff || (bytes[at + 1] & 0xe0) !== 0xe0) break;
    const bitrate = BITRATES[bytes[at + 2] >> 4] * 1000;
    rate = RATES[(bytes[at + 2] >> 2) & 3];
    const padding = (bytes[at + 2] >> 1) & 1;
    if (!bitrate || !rate) break;
    frames += 1;
    at += Math.floor((144 * bitrate) / rate) + padding;
  }
  return ((frames - 1) * SAMPLES_PER_FRAME * 1000) / rate;
}

function filmWith(assetId: string, type: "audio" | "video"): VideoDocument {
  const doc = emptyVideoDocument("square");
  const clip = newMediaClip(type, assetId, 0, 500);
  const tracks = doc.tracks.map((track) => (track.kind === (type === "audio" ? "audio" : "visual") ? { ...track, clips: [clip] } : track));
  return { ...doc, durationMs: 500, tracks: [tracks.find((track) => track.clips.length > 0)!, ...tracks.filter((track) => track.clips.length === 0)] };
}

describe("built-in sounds", () => {
  it.each(BUILTIN_SOUNDS.map((sound) => [sound.id, sound] as const))("ships %s with the length the registry declares", (_, sound) => {
    const file = join(PUBLIC, sound.file);
    expect(existsSync(file)).toBe(true);
    expect(Math.abs(mp3DurationMs(new Uint8Array(readFileSync(file))) - sound.durationMs)).toBeLessThanOrEqual(DURATION_TOLERANCE_MS);
  });

  it("finds a sound only by its full asset id", () => {
    expect(builtinSound(soundAssetId("pop"))?.id).toBe("pop");
    expect(builtinSound("pop")).toBeUndefined();
    expect(builtinSound(soundAssetId("nope"))).toBeUndefined();
  });

  it("accepts a known sound only on an audio clip and leaves library media alone", () => {
    expect(soundAssetIssue({ type: "audio", assetId: soundAssetId("ding") })).toBeNull();
    expect(soundAssetIssue({ type: "audio", assetId: soundAssetId("nope") })).toBe("invalid");
    expect(soundAssetIssue({ type: "video", assetId: soundAssetId("ding") })).toBe("invalid");
    expect(soundAssetIssue({ type: "audio", assetId: "6f1d3b8e-2c4a-4f1e-9a7b-0c1d2e3f4a5b" })).toBeNull();
  });

  it("validates documents that use built-in sounds and refuses unknown ones", () => {
    expect(parseDocument("video", filmWith(soundAssetId("whoosh"), "audio")).ok).toBe(true);
    expect(parseDocument("video", filmWith(soundAssetId("nope"), "audio")).ok).toBe(false);
    expect(parseDocument("video", filmWith(soundAssetId("whoosh"), "video")).ok).toBe(false);
  });

  it("keeps the shared fixture the backend reads in step with the registry", () => {
    expect(readFileSync(join(ROOT, SOUND_FIXTURE_PATH), "utf8").replace(/\r\n/g, "\n")).toBe(soundFixture());
  });
});
