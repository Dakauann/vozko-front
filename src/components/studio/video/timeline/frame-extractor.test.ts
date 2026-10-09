import { describe, expect, it, vi } from "vitest";

import type { StillSource } from "@/components/studio/media/stills";

import { FrameExtractor } from "./frame-extractor";

function stills() {
  return { grab: vi.fn<StillSource["grab"]>(async () => new Blob(["frame"], { type: "image/jpeg" })), dispose: vi.fn<StillSource["dispose"]>() };
}

describe("timeline frame extraction", () => {
  it("grabs shared thumbnail requests once and keeps surviving consumers", async () => {
    const source = stills();
    const frames = new FrameExtractor(1, (assetId) => `proxy-${assetId}`, source);
    const cancelled = new AbortController();
    const active = new AbortController();
    const first = frames.request("asset", 1500, 45, cancelled.signal);
    const second = frames.request("asset", 1500, 45, active.signal);
    cancelled.abort();
    expect(await first).toBeNull();
    const url = await second;
    expect(url).toMatch(/^data:image\/jpeg;base64,/);
    expect(source.grab).toHaveBeenCalledWith("proxy-asset", 1.5, 90);
    expect(await frames.request("asset", 1500, 45, active.signal)).toBe(url);
    expect(source.grab).toHaveBeenCalledTimes(1);
    frames.dispose();
  });

  it("settles queued and running requests when the editor is disposed", async () => {
    const source = stills();
    const frames = new FrameExtractor(1, undefined, source);
    const signal = new AbortController().signal;
    const running = frames.request("asset", 0, 45, signal);
    const queued = frames.request("asset", 1000, 45, signal);
    frames.dispose();
    expect(await running).toBeNull();
    expect(await queued).toBeNull();
    expect(await frames.request("asset", 0, 45, signal)).toBeNull();
    expect(source.dispose).toHaveBeenCalled();
    expect(source.grab).toHaveBeenCalledTimes(1);
  });
});
