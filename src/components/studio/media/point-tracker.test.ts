import { describe, expect, it } from "vitest";

import type { BoxTrackRequest } from "@/lib/studio/point-track";

import type { MediaEvent, MediaPort, MediaRequest } from "./media-protocol";
import { trackPoint } from "./point-tracker";

const REQUEST: BoxTrackRequest = { boxPoint: { x: 0.5, y: 0.5 }, boxSize: 0.1, boxAspect: 1, fit: "cover", atMs: 0, fromMs: 0, toMs: 1000, direction: "both" };

function fakePort() {
  const sent: MediaRequest[] = [];
  let emit: (event: MediaEvent) => void = () => undefined;
  let broken: () => void = () => undefined;
  let closed = 0;
  const port: MediaPort = {
    send: (request) => sent.push(request),
    listen: (onEvent, onBroken) => {
      emit = onEvent;
      broken = onBroken;
    },
    close: () => {
      closed += 1;
    },
  };
  return { port, sent, emit: (event: MediaEvent) => emit(event), breakDown: () => broken(), closed: () => closed };
}

describe("tracking a point in the media worker", () => {
  it("sends the job, passes progress on and closes the worker with the outcome", async () => {
    const fake = fakePort();
    const seen: number[] = [];
    const pending = trackPoint(new Blob(), REQUEST, { onProgress: (done) => seen.push(done) }, () => fake.port);
    const sent = fake.sent[0];
    expect(sent).toMatchObject({ kind: "track", request: REQUEST });
    const id = (sent as { id: string }).id;
    fake.emit({ kind: "track-progress", id: "other", done: 0.9 });
    fake.emit({ kind: "track-progress", id, done: 0.5 });
    fake.emit({ kind: "track-done", id, outcome: { kind: "flat" } });
    expect(await pending).toEqual({ kind: "flat" });
    expect(seen).toEqual([0.5]);
    expect(fake.closed()).toBe(1);
  });

  it("cancels the job and closes the worker when asked to stop", async () => {
    const fake = fakePort();
    const controller = new AbortController();
    const pending = trackPoint(new Blob(), REQUEST, { signal: controller.signal }, () => fake.port);
    controller.abort();
    expect(await pending).toEqual({ kind: "cancelled" });
    expect(fake.sent.at(-1)).toMatchObject({ kind: "track-cancel" });
    expect(fake.closed()).toBe(1);
  });

  it("fails closed when the worker breaks or cannot start", async () => {
    const fake = fakePort();
    const pending = trackPoint(new Blob(), REQUEST, {}, () => fake.port);
    fake.breakDown();
    expect(await pending).toEqual({ kind: "failed" });
    expect(await trackPoint(new Blob(), REQUEST, {}, () => null)).toEqual({ kind: "unsupported" });
  });
});
