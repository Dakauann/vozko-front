import { describe, expect, it } from "vitest";

import { METER_FLOOR_DB, type StereoMeter } from "@/lib/studio/live-meter";

import type { MeterFrame } from "./audio-meters";
import { MeterHub, type MasterReading } from "./meter-hub";

function frames() {
  const queue = new Map<number, () => void>();
  let next = 1;
  return {
    request: (callback: () => void) => {
      queue.set(next, callback);
      return next++;
    },
    cancel: (handle: number) => void queue.delete(handle),
    pending: () => queue.size,
    run: () => {
      const callbacks = [...queue.values()];
      queue.clear();
      for (const callback of callbacks) callback();
    },
  };
}

const loud: MeterFrame = { master: { left: 0.5, right: 0.25, power: 0.1 }, tracks: { music: { left: 1, right: 0.5 } } };
const silent: MeterFrame = { master: { left: 0, right: 0, power: 0 }, tracks: { music: { left: 0, right: 0 } } };

function hub(source: { frame: MeterFrame | null; playing: boolean; now: number }) {
  const scheduler = frames();
  const meters = new MeterHub({ read: () => source.frame, playing: () => source.playing, frames: scheduler, now: () => source.now });
  return { meters, scheduler };
}

describe("meter hub", () => {
  it("draws every subscriber from one frame loop while playing and stops once the meters settle", () => {
    const source = { frame: loud as MeterFrame | null, playing: true, now: 0 };
    const { meters, scheduler } = hub(source);
    const master: MasterReading[] = [];
    const music: StereoMeter[] = [];
    const voice: StereoMeter[] = [];
    meters.onMaster((reading) => master.push(reading));
    meters.onTrack("music", (meter) => music.push(meter));
    const stopVoice = meters.onTrack("voice", (meter) => voice.push(meter));
    expect(scheduler.pending()).toBe(1);
    scheduler.run();
    expect(master.at(-1)!.meter.leftDb).toBeCloseTo(-6.02, 2);
    expect(master.at(-1)!.shortTermLufs).toBeCloseTo(-10.691, 3);
    expect(music.at(-1)!.clipped).toBe(true);
    expect(voice.at(-1)!.leftDb).toBe(METER_FLOOR_DB);
    stopVoice();
    const voiceDraws = voice.length;
    source.frame = silent;
    source.playing = false;
    source.now = 10_000;
    scheduler.run();
    expect(voice.length).toBe(voiceDraws);
    expect(master.at(-1)!.meter.left.db).toBe(METER_FLOOR_DB);
    expect(scheduler.pending()).toBe(0);
  });

  it("wakes again when playback starts, clears clip lights and stops when nobody listens", () => {
    const source = { frame: loud as MeterFrame | null, playing: true, now: 0 };
    const { meters, scheduler } = hub(source);
    const music: StereoMeter[] = [];
    const stop = meters.onTrack("music", (meter) => music.push(meter));
    scheduler.run();
    expect(music.at(-1)!.clipped).toBe(true);
    meters.clearClips();
    expect(music.at(-1)!.clipped).toBe(false);
    source.frame = null;
    source.playing = false;
    source.now = 10_000;
    scheduler.run();
    expect(scheduler.pending()).toBe(0);
    meters.wake();
    expect(scheduler.pending()).toBe(1);
    stop();
    expect(scheduler.pending()).toBe(0);
    meters.wake();
    expect(scheduler.pending()).toBe(0);
  });
});
