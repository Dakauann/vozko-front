"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  listenFailure,
  recognitionConstructor,
  type ListenFailure,
  type Recognition,
  type RecognitionResultEvent,
} from "@/lib/voice/browser-speech";

interface Options {
  lang: string;
  continuous: boolean;
  onFinal: (text: string) => void;
  onFailure?: (failure: ListenFailure) => void;
}

const noSubscription = () => () => {};

export function useSpeechRecognition({ lang, continuous, onFinal, onFailure }: Options) {
  const supported = useSyncExternalStore(noSubscription, () => recognitionConstructor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const callbacks = useRef({ onFinal, onFailure });

  useEffect(() => {
    callbacks.current = { onFinal, onFailure };
  }, [onFinal, onFailure]);

  const start = useCallback(() => {
    const Ctor = recognitionConstructor();
    if (!Ctor || recognition.current) return;
    const instance = new Ctor();
    instance.lang = lang;
    instance.continuous = continuous;
    instance.interimResults = true;
    instance.onstart = () => setListening(true);
    instance.onresult = (event: RecognitionResultEvent) => {
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          const text = transcript.trim();
          if (text) callbacks.current.onFinal(text);
        } else {
          pending += transcript;
        }
      }
      setInterim(pending.trim());
    };
    instance.onerror = (event) => {
      const failure = listenFailure(event.error);
      if (failure) callbacks.current.onFailure?.(failure);
    };
    instance.onend = () => {
      if (recognition.current === instance) recognition.current = null;
      setListening(false);
      setInterim("");
    };
    recognition.current = instance;
    try {
      instance.start();
    } catch {
      recognition.current = null;
      callbacks.current.onFailure?.("unavailable");
    }
  }, [lang, continuous]);

  const stop = useCallback(() => recognition.current?.stop(), []);

  const abort = useCallback(() => {
    const instance = recognition.current;
    recognition.current = null;
    instance?.abort();
  }, []);

  useEffect(() => abort, [abort]);

  return { supported, listening, interim, start, stop, abort };
}
