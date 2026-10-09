import { describe, expect, it } from "vitest";

import { MAX_DECODE_FAILURES, MAX_IN_FLIGHT, StreamDecoder, type Sample, type SampleReader, type StreamEvent } from "./stream-decoder";

interface FakePicture {
  at: number;
}

const FRAME = 0.1;

function fakeReader(count: number, failing = false) {
  const state = { passes: 0, finished: 0, disposed: false, closed: 0 };
  const reader: SampleReader<FakePicture> = {
    async *samples(from: number): AsyncGenerator<Sample<FakePicture>> {
      state.passes += 1;
      try {
        if (failing) throw new Error("decoder reclaimed");
        for (let i = Math.max(0, Math.floor(from / FRAME + 1e-6)); i < count; i++) {
          const timestamp = i * FRAME;
          yield { timestamp, duration: FRAME, picture: () => ({ at: timestamp }), close: () => void (state.closed += 1) };
        }
      } finally {
        state.finished += 1;
      }
    },
    dispose: () => void (state.disposed = true),
  };
  return { reader, state };
}

async function settle() {
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

function steps(events: readonly { timestamp: number }[]) {
  return events.map((event) => Math.round(event.timestamp / FRAME));
}

function record() {
  const events: StreamEvent<FakePicture>[] = [];
  const frames = () => events.flatMap((event) => (event.kind === "frame" ? [event] : []));
  return { events, frames, emit: (event: StreamEvent<FakePicture>) => void events.push(event) };
}

describe("stream decoder", () => {
  it("decodes from a seek until the picture slots are full and continues as they come back", async () => {
    const { reader, state } = fakeReader(20);
    const log = record();
    const decoder = new StreamDecoder(Promise.resolve(reader), log.emit);
    decoder.seek(1, 0);
    await settle();
    expect(steps(log.frames())).toEqual(Array.from({ length: MAX_IN_FLIGHT }, (_, i) => i));
    decoder.release(1, 2);
    await settle();
    expect(log.frames()).toHaveLength(MAX_IN_FLIGHT + 2);
    expect(log.frames().every((f) => f.generation === 1)).toBe(true);
    expect(state.closed).toBe(log.frames().length);
  });

  it("skips frames the playhead has already passed", async () => {
    const { reader } = fakeReader(20);
    const log = record();
    const decoder = new StreamDecoder(Promise.resolve(reader), log.emit);
    decoder.seek(1, 0);
    decoder.want(0.55);
    await settle();
    expect(steps(log.frames())[0]).toBe(5);
  });

  it("abandons the old pass when a newer seek arrives", async () => {
    const { reader, state } = fakeReader(20);
    const log = record();
    const decoder = new StreamDecoder(Promise.resolve(reader), log.emit);
    decoder.seek(1, 0);
    await settle();
    decoder.seek(2, 1);
    await settle();
    expect(state.finished).toBe(1);
    const latest = log.frames().filter((f) => f.generation === 2);
    expect(steps(latest)[0]).toBe(10);
    expect(latest).toHaveLength(MAX_IN_FLIGHT);
  });

  it("reports the end of the media", async () => {
    const { reader } = fakeReader(10);
    const log = record();
    const decoder = new StreamDecoder(Promise.resolve(reader), log.emit);
    decoder.seek(1, 0.85);
    await settle();
    expect(steps(log.frames())).toEqual([8, 9]);
    expect(log.events.at(-1)).toEqual({ kind: "end", generation: 1 });
  });

  it("asks for a fresh seek after a decoder error and gives up when errors repeat", async () => {
    const { reader } = fakeReader(10, true);
    const log = record();
    const decoder = new StreamDecoder(Promise.resolve(reader), log.emit);
    for (let generation = 1; generation <= MAX_DECODE_FAILURES; generation++) {
      decoder.seek(generation, 0);
      await settle();
    }
    expect(log.events.map((event) => event.kind)).toEqual([...Array(MAX_DECODE_FAILURES - 1).fill("reset"), "failed"]);
  });

  it("fails once when the media cannot be decoded and stops after close", async () => {
    const log = record();
    const undecodable = new StreamDecoder<FakePicture>(Promise.resolve(null), log.emit);
    undecodable.seek(1, 0);
    undecodable.seek(2, 0);
    await settle();
    expect(log.events).toEqual([{ kind: "failed" }]);
    const { reader, state } = fakeReader(10);
    const closing = record();
    const decoder = new StreamDecoder(Promise.resolve(reader), closing.emit);
    decoder.seek(1, 0);
    decoder.close();
    await settle();
    expect(closing.frames()).toHaveLength(0);
    expect(state.disposed).toBe(true);
  });
});
