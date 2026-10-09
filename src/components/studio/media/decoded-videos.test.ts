import { describe, expect, it, vi } from "vitest";

import type { VideoSource } from "@/lib/studio/scene/scene";

import type { LoadedMediaFile } from "../canvas/media-files";
import { DecodedVideos } from "./decoded-videos";
import type { MediaEvent, MediaPort, MediaRequest } from "./media-protocol";

function fakePort() {
  const sent: MediaRequest[] = [];
  let onEvent: (event: MediaEvent) => void = () => undefined;
  let onBroken: () => void = () => undefined;
  const port: MediaPort = {
    send: (request) => void sent.push(request),
    listen: (event, broken) => {
      onEvent = event;
      onBroken = broken;
    },
    close: vi.fn(),
  };
  return { port, sent, emit: (event: MediaEvent) => onEvent(event), breakDown: () => onBroken() };
}

function file(contentType = "video/mp4"): LoadedMediaFile {
  return { blob: new Blob(["x"], { type: contentType }), contentType, url: "blob:x" };
}

function clip(clipId: string, assetId: string, sourceMs: number) {
  const source: VideoSource = { kind: "video", clipId, assetId, sourceMs };
  return { source, visible: true };
}

function frame() {
  return { close: vi.fn() } as unknown as VideoFrame;
}

async function settle() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function setup(files: (fileId: string) => Promise<LoadedMediaFile | null> = async () => file()) {
  const port = fakePort();
  const proxies = new Map<string, string>();
  const onFrame = vi.fn();
  const observer = { undecodable: vi.fn(), broken: vi.fn() };
  const videos = new DecodedVideos(port.port, files, (assetId) => proxies.get(assetId) ?? assetId, onFrame, observer);
  return { ...port, videos, proxies, onFrame, observer };
}

describe("decoded videos", () => {
  it("opens a stream once the file is loaded, seeks to the clip time and shows its frames", async () => {
    const { videos, sent, emit } = setup();
    expect(videos.sync([clip("c1", "a1", 2000)])).toEqual([]);
    await settle();
    videos.sync([clip("c1", "a1", 2000)]);
    const opened = sent.find((request) => request.kind === "open")!;
    expect(sent).toContainEqual({ stream: opened.stream, kind: "seek", generation: 1, seconds: 2 });
    const picture = frame();
    emit({ stream: opened.stream, kind: "frame", generation: 1, timestamp: 1.98, duration: 0.04, picture });
    videos.sync([clip("c1", "a1", 2000)]);
    expect(videos.picture("c1")).toBe(picture);
  });

  it("is ready only when every clip shows the exact frame for its time", async () => {
    const { videos, sent, emit } = setup();
    const at = (ms: number) => [clip("c1", "a1", ms)];
    videos.sync(at(1000));
    expect(videos.ready(at(1000))).toBe(false);
    await settle();
    videos.sync(at(1000));
    const opened = sent.find((request) => request.kind === "open")!;
    emit({ stream: opened.stream, kind: "frame", generation: 1, timestamp: 0.99, duration: 0.04, picture: frame() });
    videos.sync(at(1000));
    expect(videos.ready(at(1000))).toBe(true);
    expect(videos.ready(at(1100))).toBe(false);
  });

  it("hands clips to the element fallback when their file cannot be decoded", async () => {
    const { videos, sent, emit, observer } = setup();
    videos.sync([clip("c1", "a1", 0), clip("c2", "a2", 0)]);
    await settle();
    videos.sync([clip("c1", "a1", 0), clip("c2", "a2", 0)]);
    const first = sent.find((request) => request.kind === "open")!;
    emit({ stream: first.stream, kind: "failed" });
    expect(observer.undecodable).toHaveBeenCalledTimes(1);
    const rest = videos.sync([clip("c1", "a1", 0), clip("c2", "a2", 0), clip("c3", "a1", 0)]);
    expect(rest.map((c) => c.source.clipId)).toEqual(["c1", "c3"]);
    expect(sent).toContainEqual({ stream: first.stream, kind: "close" });
    const images = setup(async () => file("image/png"));
    images.videos.sync([clip("c1", "a1", 0)]);
    await settle();
    expect(images.videos.sync([clip("c1", "a1", 0)])).toHaveLength(1);
  });

  it("falls back for everything when the worker is missing or breaks", async () => {
    const without = new DecodedVideos(null, async () => file(), (id) => id, vi.fn());
    expect(without.sync([clip("c1", "a1", 0)])).toHaveLength(1);
    const { videos, breakDown, emit, sent, observer } = setup();
    videos.sync([clip("c1", "a1", 0)]);
    await settle();
    videos.sync([clip("c1", "a1", 0)]);
    const picture = frame();
    const opened = sent.find((request) => request.kind === "open")!;
    emit({ stream: opened.stream, kind: "frame", generation: 1, timestamp: 0, duration: 0.04, picture });
    breakDown();
    expect(observer.broken).toHaveBeenCalledTimes(1);
    expect(videos.sync([clip("c1", "a1", 0)])).toHaveLength(1);
    expect(videos.picture("c1")).toBeNull();
    expect(picture.close).toHaveBeenCalled();
  });

  it("reopens a clip on its proxy and drops frames from the old stream", async () => {
    const { videos, sent, emit, proxies } = setup();
    videos.sync([clip("c1", "a1", 0)]);
    await settle();
    const original = sent.find((request) => request.kind === "open")!.stream;
    proxies.set("a1", "p1");
    videos.sync([clip("c1", "a1", 0)]);
    await settle();
    const opens = sent.filter((request) => request.kind === "open");
    expect(opens).toHaveLength(2);
    expect(opens[1].stream).not.toBe(original);
    expect(sent).toContainEqual({ stream: original, kind: "close" });
    const late = frame();
    emit({ stream: original, kind: "frame", generation: 1, timestamp: 0, duration: 0.04, picture: late });
    expect(late.close).toHaveBeenCalled();
  });

  it("closes the streams of clips that left the scene and everything on dispose", async () => {
    const { videos, sent, port } = setup();
    videos.sync([clip("c1", "a1", 0), clip("c2", "a2", 0)]);
    await settle();
    videos.sync([clip("c2", "a2", 0)]);
    const closed = sent.filter((request) => request.kind === "close");
    expect(closed).toHaveLength(1);
    videos.dispose();
    expect(sent.filter((request) => request.kind === "close")).toHaveLength(2);
    expect(port.close).toHaveBeenCalled();
  });
});
