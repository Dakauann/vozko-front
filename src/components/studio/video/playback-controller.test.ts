import { describe, expect, it, vi } from "vitest";

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";

import { PlaybackController, type FrameScheduler, type PlaybackAudio } from "./playback-controller";
import { createVideoViewStore } from "./view-store";

function doc(): VideoDocument {
  const d = emptyVideoDocument("square");
  d.tracks[0].clips = [{ ...newMediaClip("image", "img", 0, 4000), id: "i" }];
  d.durationMs = 4000;
  return d;
}

function setup() {
  let now = 100;
  const callbacks: (() => void)[] = [];
  const audio: PlaybackAudio = { now: () => now, prepare: vi.fn(async () => undefined), play: vi.fn(), stop: vi.fn() };
  const frames: FrameScheduler = {
    request: (callback) => callbacks.push(callback),
    cancel: (handle) => {
      callbacks[handle - 1] = () => undefined;
    },
  };
  const view = createVideoViewStore();
  const document = doc();
  const controller = new PlaybackController(view, audio, () => document, frames);
  const tick = (seconds: number) => {
    now += seconds;
    const pending = callbacks.splice(0);
    pending.forEach((callback) => callback());
  };
  return { controller, view, audio, tick };
}

describe("PlaybackController", () => {
  it("plays from the playhead on the audio clock and schedules audio once", async () => {
    const { controller, view, audio, tick } = setup();
    controller.seek(1000);
    await controller.play();
    expect(audio.play).toHaveBeenCalledWith(expect.anything(), 1000, expect.any(Function), { soloTrackIds: [] });
    tick(0.5);
    expect(view.getState()).toMatchObject({ playing: true, playheadMs: 1500 });
  });

  it("stops at the end of the timeline", async () => {
    const { controller, view, tick } = setup();
    await controller.play();
    tick(5);
    expect(view.getState()).toMatchObject({ playing: false, playheadMs: 4000 });
  });

  it("restarts from zero when played at the end", async () => {
    const { controller, view } = setup();
    controller.seek(4000);
    await controller.play();
    expect(view.getState().playheadMs).toBe(0);
  });

  it("toggles pause where it is", async () => {
    const { controller, view, audio, tick } = setup();
    await controller.play();
    tick(1);
    controller.toggle();
    expect(view.getState()).toMatchObject({ playing: false, playheadMs: 1000 });
    expect(audio.stop).toHaveBeenCalled();
  });

  it("shuttles faster without audio and backwards", async () => {
    const { controller, view, audio, tick } = setup();
    controller.seek(2000);
    controller.shuttle(1);
    await Promise.resolve();
    controller.shuttle(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(view.getState().rate).toBe(2);
    expect(audio.play).toHaveBeenCalledTimes(1);
    controller.shuttle(-1);
    await Promise.resolve();
    await Promise.resolve();
    const before = view.getState().playheadMs;
    tick(0.5);
    expect(view.getState().playheadMs).toBe(before - 500);
    controller.shuttle(0);
    expect(view.getState().playing).toBe(false);
  });

  it("steps whole frames and clamps seeks", () => {
    const { controller, view } = setup();
    controller.stepFrames(3);
    expect(view.getState().playheadMs).toBe(100);
    controller.seek(-50);
    expect(view.getState().playheadMs).toBe(0);
    controller.seek(99_000);
    expect(view.getState().playheadMs).toBe(4000);
  });
});
