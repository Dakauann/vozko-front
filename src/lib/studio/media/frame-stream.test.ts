import { describe, expect, it } from "vitest";

import { DECODE_THROUGH_SEC, FrameStream, type DecodedFrame, type StreamRequest } from "./frame-stream";

interface FakePicture {
  at: number;
  closed: boolean;
  close(): void;
}

function picture(at: number): FakePicture {
  return {
    at,
    closed: false,
    close() {
      this.closed = true;
    },
  };
}

function frame(generation: number, timestamp: number, duration = 0.1): DecodedFrame<FakePicture> {
  return { picture: picture(timestamp), generation, timestamp, duration };
}

function seekOf(requests: readonly StreamRequest[]) {
  return requests.find((request) => request.kind === "seek");
}

describe("frame stream", () => {
  it("asks for a seek before it has anything and shows the frame covering the time", () => {
    const stream = new FrameStream<FakePicture>();
    const first = stream.show(2);
    expect(first.picture).toBeNull();
    expect(seekOf(first.requests)).toEqual({ kind: "seek", generation: 1, seconds: 2 });
    stream.receive(frame(1, 1.95));
    stream.receive(frame(1, 2.05));
    const shown = stream.show(2);
    expect(shown.picture?.at).toBe(1.95);
    expect(seekOf(shown.requests)).toBeUndefined();
  });

  it("moves to newer frames as time passes and gives their slots back to the decoder", () => {
    const stream = new FrameStream<FakePicture>();
    stream.show(0);
    const frames = [frame(1, 0), frame(1, 0.1), frame(1, 0.2)];
    frames.forEach((f) => stream.receive(f));
    stream.show(0);
    const later = stream.show(0.25);
    expect(later.picture?.at).toBe(0.2);
    expect(frames[0].picture.closed && frames[1].picture.closed).toBe(true);
    expect(later.requests).toContainEqual({ kind: "release", generation: 1, count: 2 });
    expect(later.requests).toContainEqual({ kind: "want", seconds: 0.25 });
  });

  it("seeks when the time goes back or jumps far ahead, and keeps the last picture until the new one arrives", () => {
    const stream = new FrameStream<FakePicture>();
    stream.show(5);
    stream.receive(frame(1, 5));
    stream.show(5);
    const back = stream.show(1);
    expect(seekOf(back.requests)).toEqual({ kind: "seek", generation: 2, seconds: 1 });
    expect(back.picture?.at).toBe(5);
    const stale = frame(1, 5.1);
    stream.receive(stale);
    expect(stale.picture.closed).toBe(true);
    stream.receive(frame(2, 1));
    expect(stream.show(1).picture?.at).toBe(1);
    const ahead = stream.show(1 + 0.1 + DECODE_THROUGH_SEC + 0.5);
    expect(seekOf(ahead.requests)?.generation).toBe(3);
  });

  it("sends one seek at a time while scrubbing and only the latest time after it", () => {
    const stream = new FrameStream<FakePicture>();
    stream.show(3);
    expect(seekOf(stream.show(1).requests)).toBeUndefined();
    expect(stream.show(1).requests).not.toContainEqual(expect.objectContaining({ kind: "want", seconds: 1 }));
    stream.receive(frame(1, 3));
    expect(seekOf(stream.show(1).requests)).toEqual({ kind: "seek", generation: 2, seconds: 1 });
  });

  it("does not chase past the end of the media but seeks again when the time comes back", () => {
    const stream = new FrameStream<FakePicture>();
    stream.show(9);
    stream.receive(frame(1, 8.9));
    stream.end(1);
    expect(seekOf(stream.show(12).requests)).toBeUndefined();
    expect(stream.show(12).picture?.at).toBe(8.9);
    const empty = new FrameStream<FakePicture>();
    empty.show(20);
    empty.end(1);
    expect(seekOf(empty.show(20).requests)).toBeUndefined();
    expect(seekOf(empty.show(4).requests)?.seconds).toBe(4);
  });

  it("knows when the shown frame is certainly the one for the time", () => {
    const stream = new FrameStream<FakePicture>();
    stream.show(1);
    expect(stream.exact(1)).toBe(false);
    stream.receive(frame(1, 0.95));
    stream.show(1);
    expect(stream.exact(1)).toBe(true);
    expect(stream.exact(1.06)).toBe(false);
    stream.receive(frame(1, 1.05));
    stream.show(1.06);
    expect(stream.exact(1.2)).toBe(false);
    stream.end(1);
    expect(stream.exact(1.2)).toBe(true);
  });

  it("seeks again after the decoder recovers and closes everything when disposed", () => {
    const stream = new FrameStream<FakePicture>();
    stream.show(1);
    const held = frame(1, 1);
    const queued = frame(1, 1.1);
    stream.receive(held);
    stream.receive(queued);
    stream.show(1);
    stream.reset();
    expect(seekOf(stream.show(1).requests)?.generation).toBe(2);
    stream.dispose();
    expect(held.picture.closed && queued.picture.closed).toBe(true);
    expect(stream.show(1).picture).toBeNull();
  });
});
