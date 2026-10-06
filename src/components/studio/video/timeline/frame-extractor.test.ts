import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({ fetchMediaFileAction: vi.fn() }));

import { fetchMediaFileAction } from "@/app/actions/medias";
import { FrameExtractor } from "./frame-extractor";

const fetchFile = vi.mocked(fetchMediaFileAction);

afterEach(() => vi.restoreAllMocks());

function mockFrames() {
  const video = document.createElement("video");
  Object.defineProperties(video, {
    videoWidth: { value: 1920 },
    videoHeight: { value: 1080 },
    duration: { value: 10 },
  });
  const canvas = document.createElement("canvas");
  const encode = vi.spyOn(canvas, "toBlob").mockImplementation((callback) => {
    queueMicrotask(() => callback(new Blob(["frame"], { type: "image/jpeg" })));
  });
  vi.spyOn(canvas, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  const create = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
    if (tag === "video") {
      queueMicrotask(() => video.dispatchEvent(new Event("loadeddata")));
      return video;
    }
    return tag === "canvas" ? canvas : create(tag);
  }) as typeof document.createElement);
  vi.stubGlobal("URL", { createObjectURL: () => "blob:video", revokeObjectURL: vi.fn() });
  vi.spyOn(video, "load").mockImplementation(() => undefined);
  fetchFile.mockResolvedValue({ data: { blob: new Blob(), contentType: "video/mp4" } } as Awaited<ReturnType<typeof fetchMediaFileAction>>);
  return { encode };
}

afterEach(() => vi.unstubAllGlobals());

describe("timeline frame extraction", () => {
  it("encodes shared thumbnail requests once and keeps surviving consumers", async () => {
    const { encode } = mockFrames();
    const frames = new FrameExtractor();
    const cancelled = new AbortController();
    const active = new AbortController();
    const first = frames.request("asset", 0, 45, cancelled.signal);
    const second = frames.request("asset", 0, 45, active.signal);
    cancelled.abort();
    expect(await first).toBeNull();
    const url = await second;
    expect(url).toMatch(/^data:image\/jpeg;base64,/);
    expect(encode).toHaveBeenCalledTimes(1);
    expect(await frames.request("asset", 0, 45, active.signal)).toBe(url);
    expect(encode).toHaveBeenCalledTimes(1);
    frames.dispose();
  });

  it("settles queued and running requests when the editor is disposed", async () => {
    const { encode } = mockFrames();
    const frames = new FrameExtractor();
    const signal = new AbortController().signal;
    const running = frames.request("asset", 0, 45, signal);
    const queued = frames.request("asset", 1000, 45, signal);
    frames.dispose();
    expect(await running).toBeNull();
    expect(await queued).toBeNull();
    expect(await frames.request("asset", 0, 45, signal)).toBeNull();
    expect(encode).not.toHaveBeenCalled();
  });
});
