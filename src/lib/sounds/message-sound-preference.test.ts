import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { messageSoundsMuted, setMessageSoundsMuted, useMessageSoundsMuted } from "./message-sound-preference";

describe("message sound preference", () => {
    afterEach(() => window.localStorage.clear());

    it("is audible until the operator mutes it", () => {
        expect(messageSoundsMuted()).toBe(false);
        setMessageSoundsMuted(true);
        expect(messageSoundsMuted()).toBe(true);
    });

    it("keeps every reader of the preference in step", () => {
        const first = renderHook(() => useMessageSoundsMuted());
        const second = renderHook(() => useMessageSoundsMuted());
        act(() => setMessageSoundsMuted(true));
        expect(first.result.current).toBe(true);
        expect(second.result.current).toBe(true);
        act(() => setMessageSoundsMuted(false));
        expect(first.result.current).toBe(false);
    });

    it("keeps reading the preference saved before this version", () => {
        window.localStorage.setItem("crm_sound_muted", "true");
        expect(messageSoundsMuted()).toBe(true);
    });
});
