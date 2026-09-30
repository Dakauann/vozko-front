"use client";

import { useEffect, useRef } from "react";

import { callSoundCue, type CallSoundState, type CallSoundStatus } from "@/lib/sounds/rules";
import { soundPlayer } from "@/lib/sounds/sound-player";

const UNLOCK_EVENTS = ["pointerdown", "keydown"] as const;

export function useCallSounds(status: CallSoundStatus, offered: boolean): void {
  const previous = useRef<CallSoundState>({ status: null, offered: false });
  const stopRinging = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unlock = () => soundPlayer.unlock();
    UNLOCK_EVENTS.forEach((event) => document.addEventListener(event, unlock));
    return () => UNLOCK_EVENTS.forEach((event) => document.removeEventListener(event, unlock));
  }, []);

  useEffect(() => {
    const next = { status, offered };
    const { ring, cue } = callSoundCue(previous.current, next);
    previous.current = next;
    if (cue) soundPlayer.play(cue);
    if (ring && !stopRinging.current) {
      stopRinging.current = soundPlayer.loop("incomingCall");
    }
    if (!ring && stopRinging.current) {
      stopRinging.current();
      stopRinging.current = null;
    }
  }, [status, offered]);

  useEffect(
    () => () => {
      stopRinging.current?.();
      stopRinging.current = null;
    },
    [],
  );
}
