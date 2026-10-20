import { describe, expect, it } from "vitest";

import { callSoundCue, dtmfFrequencies } from "./rules";

describe("dtmf frequencies", () => {
    it("pairs each key's row and column tone per ITU-T Q.23", () => {
        expect(dtmfFrequencies("1")).toEqual([697, 1209]);
        expect(dtmfFrequencies("5")).toEqual([770, 1336]);
        expect(dtmfFrequencies("9")).toEqual([852, 1477]);
        expect(dtmfFrequencies("*")).toEqual([941, 1209]);
        expect(dtmfFrequencies("0")).toEqual([941, 1336]);
        expect(dtmfFrequencies("#")).toEqual([941, 1477]);
    });

    it("has no tone for characters that are not keys", () => {
        expect(dtmfFrequencies("+")).toBeNull();
        expect(dtmfFrequencies("a")).toBeNull();
    });
});

describe("call sound cues", () => {
    it("rings for an offer while free and stops once handled", () => {
        expect(callSoundCue({ status: null, offered: false }, { status: null, offered: true }).ring).toBe(true);
        expect(callSoundCue({ status: null, offered: true }, { status: "answered", offered: false }).ring).toBe(false);
    });

    it("does not ring over a call in progress", () => {
        expect(callSoundCue({ status: "answered", offered: false }, { status: "answered", offered: true }).ring).toBe(false);
    });

    it("marks the moment a call connects", () => {
        expect(callSoundCue({ status: "ringing", offered: false }, { status: "answered", offered: false }).cue).toBe("callConnected");
        expect(callSoundCue({ status: null, offered: true }, { status: "answered", offered: false }).cue).toBe("callConnected");
        expect(callSoundCue({ status: "answered", offered: false }, { status: "answered", offered: false }).cue).toBeNull();
    });

    it("marks the moment a live call ends", () => {
        expect(callSoundCue({ status: "answered", offered: false }, { status: "ended", offered: false }).cue).toBe("callEnded");
        expect(callSoundCue({ status: "ringing", offered: false }, { status: "ended", offered: false }).cue).toBe("callEnded");
        expect(callSoundCue({ status: "ended", offered: false }, { status: null, offered: false }).cue).toBeNull();
    });
});
