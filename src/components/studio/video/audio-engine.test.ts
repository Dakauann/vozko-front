import { describe, expect, it, vi } from "vitest";

import { loudnessProfile } from "@/lib/studio/loudness";

import { AudioEngine } from "./audio-engine";

function buffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
  return { numberOfChannels: channels.length, sampleRate, length: channels[0].length, duration: channels[0].length / sampleRate, getChannelData: (i: number) => channels[i] } as unknown as AudioBuffer;
}

describe("audio engine loudness profiles", () => {
  it("measures each asset once, keeps the profile for synchronous reads and retries an asset that failed to load", async () => {
    const engine = new AudioEngine();
    const tone = Float32Array.from({ length: 8000 }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 1000 * i) / 8000));
    const load = vi.spyOn(engine, "buffer").mockImplementation(async (assetId) => (assetId === "song" ? buffer([tone], 8000) : null));
    expect(engine.loudnessOf("song")).toBeUndefined();
    const [first, second] = await Promise.all([engine.loudness("song"), engine.loudness("song")]);
    expect(first).toEqual(loudnessProfile([tone], 8000));
    expect(second).toBe(first);
    expect(engine.loudnessOf("song")).toBe(first);
    expect(await engine.loudness("broken")).toBeNull();
    await engine.loudness("broken");
    expect(load.mock.calls.filter(([id]) => id === "song")).toHaveLength(1);
    expect(load.mock.calls.filter(([id]) => id === "broken")).toHaveLength(2);
  });
});
