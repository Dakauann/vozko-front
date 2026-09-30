"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  listenFailure,
  localRecognition,
  recognitionConstructor,
  whenLocalReady,
  type ListenFailure,
  type LocalRecognition,
  type LocalWait,
  type Recognition,
  type RecognitionConstructor,
  type RecognitionResultEvent,
} from "@/lib/voice/browser-speech";

interface Options {
  lang: string;
  continuous: boolean;
  onFinal: (text: string) => void;
  onFailure?: (failure: ListenFailure) => void;
}

const noSubscription = () => () => {};

export function useSpeechRecognition({
  lang,
  continuous,
  onFinal,
  onFailure,
}: Options) {
  const supported = useSyncExternalStore(
    noSubscription,
    () => recognitionConstructor() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const callbacks = useRef({ onFinal, onFailure });
  const generation = useRef(0);
  const preparing = useRef(false);

  useEffect(() => {
    callbacks.current = { onFinal, onFailure };
  }, [onFinal, onFailure]);

  const begin = useCallback(
    (Ctor: RecognitionConstructor, local: LocalRecognition) => {
      const instance = new Ctor();
      if (local === "ready") instance.processLocally = true;
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
        if (!failure) return;
        callbacks.current.onFailure?.(failure === "network" && local === "installing" ? "installing" : failure);
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
    },
    [lang, continuous],
  );

  const start = useCallback(() => {
    const Ctor = recognitionConstructor();
    if (!Ctor || recognition.current || preparing.current) return;
    const local = localRecognition(Ctor, lang);
    if (typeof local === "string") {
      begin(Ctor, local);
      return;
    }
    const round = generation.current;
    preparing.current = true;
    void local.then((ready) => {
      if (round !== generation.current) return;
      preparing.current = false;
      begin(Ctor, ready);
    });
  }, [lang, begin]);

  const stop = useCallback(() => recognition.current?.stop(), []);

  const abort = useCallback(() => {
    generation.current += 1;
    preparing.current = false;
    const instance = recognition.current;
    recognition.current = null;
    instance?.abort();
  }, []);

  const waitForLocal = useCallback(() => {
    const Ctor = recognitionConstructor();
    return Ctor ? whenLocalReady(Ctor, lang) : Promise.resolve<LocalWait>("failed");
  }, [lang]);

  useEffect(() => abort, [abort]);

  return { supported, listening, interim, start, stop, abort, waitForLocal };
}
