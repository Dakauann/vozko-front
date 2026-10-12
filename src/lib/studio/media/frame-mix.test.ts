import { describe, expect, it } from "vitest";

import { FrameStream, type DecodedFrame } from "./frame-stream";

interface FakePicture {
  at: number;
  close(): void;
}

function frame(generation: number, timestamp: number): DecodedFrame<FakePicture> {
  return { picture: { at: timestamp, close: () => undefined }, generation, timestamp, duration: 0.1 };
}

describe("frame mix in the frame stream", () => {
  it("weighs the next frame by how far the time sits between the two decoded frames", () => {
    const stream = new FrameStream<FakePicture>();
    stream.show(1);
    stream.receive(frame(1, 1));
    stream.receive(frame(1, 1.1));
    stream.show(1.025);
    const mixed = stream.blend(1.025);
    expect(mixed?.picture.at).toBe(1.1);
    expect(mixed?.weight).toBeCloseTo(0.25, 9);
    expect(stream.blend(1)).toBeNull();
  });

  it("is ready for a mixed frame only once the next frame has arrived or the file has ended", () => {
    const stream = new FrameStream<FakePicture>();
    stream.show(0);
    stream.receive(frame(1, 0));
    stream.show(0.05);
    expect(stream.exact(0.05)).toBe(true);
    expect(stream.mixReady(0.05)).toBe(false);
    expect(stream.blend(0.05)).toBeNull();
    stream.receive(frame(1, 0.1));
    expect(stream.mixReady(0.05)).toBe(true);
    stream.end(1);
    expect(stream.mixReady(0.05)).toBe(true);
  });
});
