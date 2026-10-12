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

function setup({ latency = 0, lead = 0 } = {}) {
  let now = 100;
  const callbacks: (() => void)[] = [];
  const audio: PlaybackAudio = { heard: () => now - latency, startsAt: () => now + lead, prepare: vi.fn(async () => undefined), play: vi.fn(), update: vi.fn(), stop: vi.fn() };
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
    expect(audio.play).toHaveBeenCalledWith(expect.anything(), expect.any(Function), { soloTrackIds: [], rate: 1 });
    const positionAt = vi.mocked(audio.play).mock.calls[0][1];
    expect(positionAt(100)).toBe(1000);
    tick(0.5);
    expect(view.getState()).toMatchObject({ playing: true, playheadMs: 1500 });
  });

  it("shows the frame of the sound reaching the speakers, not the one being scheduled", async () => {
    const { controller, view, audio, tick } = setup({ latency: 0.1, lead: 0.05 });
    controller.seek(1000);
    await controller.play();
    const positionAt = vi.mocked(audio.play).mock.calls[0][1];
    expect(positionAt(100.05)).toBe(1000);
    tick(0.1);
    expect(view.getState().playheadMs).toBe(1000);
    tick(0.15);
    expect(view.getState().playheadMs).toBe(1100);
    expect(controller.position()).toBeCloseTo(1100);
  });

  it("updates the sound after an edit without restarting it or moving the picture", async () => {
    const { controller, view, audio, tick } = setup();
    await controller.play();
    tick(1);
    const stops = vi.mocked(audio.stop).mock.calls.length;
    controller.documentChanged();
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audio.stop).toHaveBeenCalledTimes(stops);
    expect(audio.update).toHaveBeenCalledWith(expect.anything(), expect.any(Function), { soloTrackIds: [], rate: 1 });
    const positionAt = vi.mocked(audio.update).mock.calls[0][1];
    expect(positionAt(101.5)).toBe(1500);
    tick(0.5);
    expect(view.getState().playheadMs).toBe(1500);
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

  it("shuttles with sound up to twice the speed, silent beyond it, and backwards", async () => {
    const { controller, view, audio, tick } = setup();
    controller.seek(2000);
    controller.shuttle(1);
    await Promise.resolve();
    controller.shuttle(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(view.getState().rate).toBe(2);
    controller.shuttle(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(view.getState().rate).toBe(4);
    expect(vi.mocked(audio.play).mock.calls.map((call) => call[2]?.rate)).toEqual([1, 2]);
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

describe("preview speed", () => {
  it("plays at the chosen speed with sound and restarts at a new speed while playing", async () => {
    const { controller, view, audio, tick } = setup();
    controller.setPreviewRate(0.5);
    controller.toggle();
    await vi.waitFor(() => expect(audio.play).toHaveBeenCalledWith(expect.anything(), expect.any(Function), { soloTrackIds: [], rate: 0.5 }));
    tick(1);
    expect(view.getState()).toMatchObject({ playing: true, rate: 0.5, previewRate: 0.5, playheadMs: 500 });
    controller.setPreviewRate(2);
    await vi.waitFor(() => expect(audio.play).toHaveBeenLastCalledWith(expect.anything(), expect.any(Function), { soloTrackIds: [], rate: 2 }));
    tick(0.5);
    expect(view.getState().playheadMs).toBe(1500);
  });
});


describe("work area and loop", () => {
  it("plays only the marked range and stops at its out point", async () => {
    const { controller, view, tick } = setup();
    view.setState({ range: { inMs: 1000, outMs: 2500 } });
    controller.seek(3000);
    expect(controller.playRange()).toBe(true);
    await vi.waitFor(() => expect(view.getState()).toMatchObject({ playing: true, playheadMs: 1000 }));
    tick(1);
    expect(view.getState().playheadMs).toBe(2000);
    tick(1);
    expect(view.getState()).toMatchObject({ playing: false, playheadMs: 2500 });
  });

  it("refuses to play a range that is not marked", () => {
    const { controller, view } = setup();
    view.setState({ range: { inMs: 2000, outMs: null } });
    expect(controller.playRange()).toBe(false);
    expect(view.getState().playing).toBe(false);
  });

  it("repeats the range while looping", async () => {
    const { controller, view, audio, tick } = setup();
    view.setState({ range: { inMs: 1000, outMs: 2500 } });
    controller.setLoop(true);
    controller.playRange();
    await vi.waitFor(() => expect(view.getState().playing).toBe(true));
    tick(1.6);
    await vi.waitFor(() => expect(audio.play).toHaveBeenCalledTimes(2));
    expect(view.getState()).toMatchObject({ playing: true, playheadMs: 1000, loop: true });
    tick(0.5);
    expect(view.getState().playheadMs).toBe(1500);
  });

  it("repeats the whole film while looping a normal play, also backwards", async () => {
    const { controller, view, audio, tick } = setup();
    controller.setLoop(true);
    controller.seek(3500);
    await controller.play();
    tick(1);
    await vi.waitFor(() => expect(audio.play).toHaveBeenCalledTimes(2));
    expect(view.getState()).toMatchObject({ playing: true, playheadMs: 0 });
    controller.pause();
    controller.seek(300);
    controller.shuttle(-1);
    await vi.waitFor(() => expect(view.getState().playing).toBe(true));
    tick(0.5);
    await vi.waitFor(() => expect(view.getState().playheadMs).toBe(4000));
    expect(view.getState()).toMatchObject({ playing: true, rate: -1 });
  });

  it("leaves the range for the film when a seek lands outside it", async () => {
    const { controller, view, tick } = setup();
    view.setState({ range: { inMs: 1000, outMs: 2500 } });
    controller.playRange();
    await vi.waitFor(() => expect(view.getState().playing).toBe(true));
    controller.seek(3000);
    await vi.waitFor(() => expect(view.getState()).toMatchObject({ playing: true, playheadMs: 3000 }));
    tick(0.5);
    expect(view.getState()).toMatchObject({ playing: true, playheadMs: 3500 });
  });

  it("stays paused when paused while the sound gets ready", async () => {
    const { controller, view, audio } = setup();
    const started = controller.play();
    controller.pause();
    await started;
    expect(view.getState().playing).toBe(false);
    expect(audio.play).not.toHaveBeenCalled();
  });
});
