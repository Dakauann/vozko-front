"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { useCallActive } from "@/lib/call-session/call-session-control";
import type { ListenFailure } from "@/lib/voice/browser-speech";
import { nextSentences } from "@/lib/voice/speech-text";

import type { UIMessage } from "../message-list";

export type VoicePhase = "off" | "paused" | "listening" | "thinking" | "speaking";

interface Options {
  messages: UIMessage[];
  streaming: boolean;
  error: string | null;
  lang: string;
  send: (text: string) => boolean;
}

export function answerText(message: UIMessage): string {
  const texts = (message.segments ?? []).flatMap((s) => (s.kind === "text" ? [s.text] : []));
  return texts.length > 0 ? texts.join("\n\n") : message.content;
}

function latestReply(messages: UIMessage[], from: number): UIMessage | null {
  for (let i = messages.length - 1; i >= from; i--) {
    if (messages[i].role === "assistant") return messages[i];
  }
  return null;
}

export function useVoiceMode({ messages, streaming, error, lang, send }: Options) {
  const callActive = useCallActive();
  const [on, setOn] = useState(false);
  const [askedAt, setAskedAt] = useState<number | null>(null);
  const [failure, setFailure] = useState<ListenFailure | null>(null);
  const messageCount = useRef(messages.length);
  const spoken = useRef({ id: "", offset: 0, skipped: false });
  const { speak, cancel, busy, prime, speaking } = useSpeechSynthesis(lang);

  useEffect(() => {
    messageCount.current = messages.length;
  }, [messages.length]);

  const onFinal = useCallback(
    (text: string) => {
      const at = messageCount.current;
      if (send(text)) setAskedAt(at);
    },
    [send],
  );

  const onFailure = useCallback(
    (reason: ListenFailure) => {
      setFailure(reason);
      setOn(false);
      cancel();
    },
    [cancel],
  );

  const { supported, listening, interim, start, abort } = useSpeechRecognition({
    lang,
    continuous: false,
    onFinal,
    onFailure,
  });

  useEffect(() => {
    if (!on || callActive || askedAt === null || messages.length <= askedAt) return;
    const reply = latestReply(messages, askedAt);
    if (!reply) return;
    if (spoken.current.id !== reply.id) spoken.current = { id: reply.id, offset: 0, skipped: false };
    if (spoken.current.skipped) return;
    const { sentences, next } = nextSentences(answerText(reply), spoken.current.offset, !streaming);
    spoken.current.offset = next;
    sentences.forEach(speak);
  }, [on, callActive, askedAt, messages, streaming, speak]);

  const waiting = askedAt !== null && messages.length === askedAt && !error;
  const canListen = on && !callActive && !waiting && !streaming && !speaking;

  useEffect(() => {
    if (canListen && !listening && !busy()) start();
    if (!canListen && listening) abort();
  }, [canListen, listening, busy, start, abort]);

  useEffect(() => {
    if (callActive) cancel();
  }, [callActive, cancel]);

  const enable = useCallback(() => {
    setFailure(null);
    setAskedAt(null);
    spoken.current = { id: "", offset: 0, skipped: false };
    prime();
    setOn(true);
  }, [prime]);

  const disable = useCallback(() => {
    setOn(false);
    abort();
    cancel();
  }, [abort, cancel]);

  const skip = useCallback(() => {
    spoken.current.skipped = true;
    cancel();
  }, [cancel]);

  const phase: VoicePhase = !on
    ? "off"
    : callActive
      ? "paused"
      : speaking
        ? "speaking"
        : listening
          ? "listening"
          : "thinking";

  return {
    supported,
    phase,
    interim,
    failure,
    enable,
    disable,
    skip,
  };
}

export type VoiceMode = ReturnType<typeof useVoiceMode>;
