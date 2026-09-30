import { describe, expect, it, vi } from "vitest";

import { SOUND_FILES, SoundPlayer } from "./sound-player";

class FakeParam {
    value = 0;
    setValueAtTime = vi.fn();
    linearRampToValueAtTime = vi.fn();
}

function fakeContext() {
    const oscillators: { frequency: FakeParam; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];
    const sources: { loop: boolean; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];
    const raw = {
        state: "suspended",
        currentTime: 10,
        destination: {},
        resume: vi.fn(() => Promise.resolve()),
        createGain: () => ({ gain: new FakeParam(), connect: vi.fn() }),
        createOscillator: () => {
            const oscillator = { type: "", frequency: new FakeParam(), connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
            oscillators.push(oscillator);
            return oscillator;
        },
        createBufferSource: () => {
            const source = { loop: false, buffer: null as unknown, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
            sources.push(source);
            return source;
        },
        decodeAudioData: vi.fn((data: ArrayBuffer) => Promise.resolve({ decoded: data })),
    };
    return { context: raw as unknown as AudioContext, raw, oscillators, sources };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("sound player", () => {
    it("plays a key press as its two DTMF frequencies for 120 ms", () => {
        const { context, oscillators } = fakeContext();
        new SoundPlayer(() => context, vi.fn()).keyTone("5");
        expect(oscillators.map((o) => o.frequency.setValueAtTime.mock.calls[0][0])).toEqual([770, 1336]);
        for (const oscillator of oscillators) {
            expect(oscillator.start).toHaveBeenCalledWith(10);
            expect(oscillator.stop.mock.calls[0][0]).toBeCloseTo(10.12);
        }
    });

    it("ignores characters that are not keypad keys", () => {
        const { context, oscillators } = fakeContext();
        new SoundPlayer(() => context, vi.fn()).keyTone("+");
        expect(oscillators).toHaveLength(0);
    });

    it("loads each sound once and plays it every time", async () => {
        const { context, sources } = fakeContext();
        const fetchSound = vi.fn(() => Promise.resolve(new ArrayBuffer(4)));
        const player = new SoundPlayer(() => context, fetchSound);
        player.play("message");
        player.play("message");
        await settle();
        expect(fetchSound).toHaveBeenCalledTimes(1);
        expect(fetchSound).toHaveBeenCalledWith(SOUND_FILES.message);
        expect(sources.filter((s) => s.start.mock.calls.length === 1)).toHaveLength(2);
    });

    it("loops the ringtone gaplessly until stopped", async () => {
        const { context, sources } = fakeContext();
        const player = new SoundPlayer(() => context, () => Promise.resolve(new ArrayBuffer(4)));
        const stop = player.loop("incomingCall");
        await settle();
        expect(sources[0].loop).toBe(true);
        stop();
        expect(sources[0].stop).toHaveBeenCalled();
    });

    it("never starts a loop that was stopped while loading", async () => {
        const { context, sources } = fakeContext();
        const player = new SoundPlayer(() => context, () => Promise.resolve(new ArrayBuffer(4)));
        player.loop("incomingCall")();
        await settle();
        expect(sources).toHaveLength(0);
    });

    it("retries a sound whose download failed", async () => {
        const { context } = fakeContext();
        const fetchSound = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(new ArrayBuffer(4));
        const player = new SoundPlayer(() => context, fetchSound);
        player.play("callEnded");
        await settle();
        player.play("callEnded");
        await settle();
        expect(fetchSound).toHaveBeenCalledTimes(2);
    });

    it("resumes audio the browser suspended until the first gesture", () => {
        const { context, raw } = fakeContext();
        new SoundPlayer(() => context, vi.fn()).unlock();
        expect(raw.resume).toHaveBeenCalled();
    });

    it("stays silent where the browser has no Web Audio", () => {
        const player = new SoundPlayer(() => null, vi.fn());
        expect(() => {
            player.keyTone("1");
            player.play("message");
            player.loop("incomingCall")();
            player.unlock();
        }).not.toThrow();
    });
});
