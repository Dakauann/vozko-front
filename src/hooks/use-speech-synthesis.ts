"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { speechSynthesisEngine } from "@/lib/voice/browser-speech";
import { pickVoice } from "@/lib/voice/speech-text";

const noSubscription = () => () => {};

export function useSpeechSynthesis(lang: string) {
  const supported = useSyncExternalStore(noSubscription, () => speechSynthesisEngine() !== null, () => false);
  const [speaking, setSpeaking] = useState(false);
  const queued = useRef(new Set<SpeechSynthesisUtterance>());
  const generation = useRef(0);

  const speak = useCallback(
    (text: string) => {
      const engine = speechSynthesisEngine();
      if (!engine || !text.trim()) return;
      const round = generation.current;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      const voice = pickVoice(engine.getVoices(), lang);
      if (voice) utterance.voice = voice;
      const settle = () => {
        if (round !== generation.current) return;
        queued.current.delete(utterance);
        if (queued.current.size === 0) setSpeaking(false);
      };
      utterance.onend = settle;
      utterance.onerror = settle;
      queued.current.add(utterance);
      setSpeaking(true);
      engine.speak(utterance);
    },
    [lang],
  );

  const cancel = useCallback(() => {
    generation.current += 1;
    queued.current.clear();
    speechSynthesisEngine()?.cancel();
    setSpeaking(false);
  }, []);

  const busy = useCallback(() => queued.current.size > 0, []);

  const prime = useCallback(() => {
    const engine = speechSynthesisEngine();
    if (!engine) return;
    engine.cancel();
    engine.speak(new SpeechSynthesisUtterance(""));
  }, []);

  useEffect(() => cancel, [cancel]);

  return { supported, speaking, speak, cancel, busy, prime };
}
