import { describe, expect, it, vi } from "vitest";

import type { LoadedMediaFile } from "../canvas/media-files";
import { DecodedStills } from "./decoded-stills";
import type { MediaEvent, MediaPort, MediaRequest, StillRequest } from "./media-protocol";
import type { StillSource } from "./stills";

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
  const asked = () => sent.filter((request): request is StillRequest => request.kind === "still");
  return { port, asked, emit: (event: MediaEvent) => onEvent(event), breakDown: () => onBroken() };
}

function fallback() {
  return { grab: vi.fn<StillSource["grab"]>(async () => new Blob(["element"])), dispose: vi.fn<StillSource["dispose"]>() };
}

const video = async (): Promise<LoadedMediaFile> => ({ blob: new Blob(["mp4"]), contentType: "video/mp4", url: "blob:x" });

async function settle() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe("decoded stills", () => {
  it("decodes stills in the worker", async () => {
    const worker = fakePort();
    const open = vi.fn(() => worker.port);
    const stills = new DecodedStills(open, fallback(), video);
    const grabbing = stills.grab("f1", 1.5, 90);
    await settle();
    const [request] = worker.asked();
    expect(request).toMatchObject({ file: "f1", seconds: 1.5, heightPx: 90 });
    const image = new Blob(["jpeg"]);
    worker.emit({ kind: "still", id: request.id, image, decodable: true });
    expect(await grabbing).toBe(image);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("uses the element path for files the worker cannot decode and remembers them", async () => {
    const worker = fakePort();
    const element = fallback();
    const stills = new DecodedStills(() => worker.port, element, video);
    const first = stills.grab("f1", 0, 90);
    await settle();
    worker.emit({ kind: "still", id: worker.asked()[0].id, image: null, decodable: false });
    expect(await first).toBeInstanceOf(Blob);
    await stills.grab("f1", 1, 90);
    expect(worker.asked()).toHaveLength(1);
    expect(element.grab).toHaveBeenCalledTimes(2);
  });

  it("uses the element path without a worker or after it breaks", async () => {
    const element = fallback();
    await new DecodedStills(() => null, element, video).grab("f1", 0, 90);
    expect(element.grab).toHaveBeenCalledTimes(1);
    const worker = fakePort();
    const stills = new DecodedStills(() => worker.port, element, video);
    const pending = stills.grab("f2", 0, 90);
    await settle();
    worker.breakDown();
    expect(await pending).toBeInstanceOf(Blob);
    await stills.grab("f3", 0, 90);
    expect(worker.asked()).toHaveLength(1);
    expect(element.grab).toHaveBeenCalledTimes(3);
  });

  it("settles what is pending and closes the worker on dispose", async () => {
    const worker = fakePort();
    const element = fallback();
    const stills = new DecodedStills(() => worker.port, element, video);
    const pending = stills.grab("f1", 0, 90);
    await settle();
    stills.dispose();
    expect(await pending).toBeNull();
    expect(worker.port.close).toHaveBeenCalled();
    expect(element.dispose).toHaveBeenCalled();
    expect(await stills.grab("f1", 0, 90)).toBeNull();
  });
});
