"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { useCallActive } from "@/lib/call-session/call-session-control";
import type { ListenFailure } from "@/lib/voice/browser-speech";
import { nextSentences, soundsLikeInterruption } from "@/lib/voice/speech-text";

import type { UIMessage } from "../message-list";

export type VoicePhase =
  | "off"
  | "paused"
  | "downloading"
  | "starting"
  | "listening"
  | "thinking"
  | "speaking";

export const ECHO_GRACE_MS = 1500;

interface Options {
  messages: UIMessage[];
  streaming: boolean;
  error: string | null;
  lang: string;
  send: (text: string) => boolean;
  stop: () => void;
}

export function answerText(message: UIMessage): string {
  const texts = (message.segments ?? []).flatMap((s) =>
    s.kind === "text" ? [s.text] : [],
  );
  return texts.length > 0 ? texts.join("\n\n") : message.content;
}

function latestReply(messages: UIMessage[], from: number): UIMessage | null {
  for (let i = messages.length - 1; i >= from; i--) {
    if (messages[i].role === "assistant") return messages[i];
  }
  return null;
}

const silentReply = { id: "", offset: 0, skipped: false, said: "" };

export function useVoiceMode({
  messages,
  streaming,
  error,
  lang,
  send,
  stop,
}: Options) {
  const callActive = useCallActive();
  const [on, setOn] = useState(false);
  const [askedAt, setAskedAt] = useState<number | null>(null);
  const [failure, setFailure] = useState<ListenFailure | null>(null);
  const [downloading, setDownloading] = useState(false);
  const messageCount = useRef(messages.length);
  const spoken = useRef({ ...silentReply });
  const queued = useRef<string | null>(null);
  const answering = useRef(false);
  const speechEndedAt = useRef(0);
  const { speak, cancel, busy, prime, speaking } = useSpeechSynthesis(lang);

  const waiting = askedAt !== null && messages.length === askedAt && !error;

  useEffect(() => {
    messageCount.current = messages.length;
    answering.current = waiting || streaming;
  }, [messages.length, waiting, streaming]);

  useEffect(() => {
    if (!speaking) speechEndedAt.current = Date.now();
  }, [speaking]);

  const mayBeEcho = useCallback(
    () => busy() || Date.now() - speechEndedAt.current < ECHO_GRACE_MS,
    [busy],
  );

  const interrupt = useCallback(() => {
    spoken.current.skipped = true;
    cancel();
    stop();
  }, [cancel, stop]);

  const deliver = useCallback(
    (text: string) => {
      const at = messageCount.current;
      if (answering.current || !send(text)) {
        queued.current = text;
        return;
      }
      queued.current = null;
      setAskedAt(at);
    },
    [send],
  );

  const onFinal = useCallback(
    (text: string) => {
      if (mayBeEcho() && !soundsLikeInterruption(text, spoken.current.said)) return;
      if (busy() || answering.current) interrupt();
      deliver(text);
    },
    [mayBeEcho, busy, interrupt, deliver],
  );

  const onFailure = useCallback(
    (reason: ListenFailure) => {
      if (reason === "installing") {
        setDownloading(true);
        return;
      }
      setFailure(reason);
      setOn(false);
      cancel();
    },
    [cancel],
  );

  const { supported, listening, interim, start, abort, waitForLocal } =
    useSpeechRecognition({
      lang,
      continuous: false,
      onFinal,
      onFailure,
    });

  useEffect(() => {
    if (!interim || !busy()) return;
    if (soundsLikeInterruption(interim, spoken.current.said)) interrupt();
  }, [interim, busy, interrupt]);

  useEffect(() => {
    if (streaming && queued.current) stop();
    if (!streaming && !waiting && queued.current) deliver(queued.current);
  }, [streaming, waiting, stop, deliver]);

  useEffect(() => {
    if (!on || callActive || askedAt === null || messages.length <= askedAt)
      return;
    if (queued.current) return;
    const reply = latestReply(messages, askedAt);
    if (!reply) return;
    if (spoken.current.id !== reply.id)
      spoken.current = { ...silentReply, id: reply.id };
    if (spoken.current.skipped) return;
    const { sentences, next } = nextSentences(
      answerText(reply),
      spoken.current.offset,
      !streaming,
      spoken.current.said === "",
    );
    spoken.current.offset = next;
    spoken.current.said = [spoken.current.said, ...sentences].join(" ");
    sentences.forEach(speak);
  }, [on, callActive, askedAt, messages, streaming, speak]);

  const canListen = on && !callActive && !downloading;

  useEffect(() => {
    if (!downloading) return;
    let current = true;
    void waitForLocal().then((outcome) => {
      if (!current) return;
      setDownloading(false);
      if (outcome === "ready") return;
      setFailure(outcome === "stalled" ? "pack_stalled" : "network");
      setOn(false);
    });
    return () => {
      current = false;
    };
  }, [downloading, waitForLocal]);

  useEffect(() => {
    if (canListen && !listening) start();
    if (!canListen && listening) abort();
  }, [canListen, listening, start, abort]);

  useEffect(() => {
    if (callActive) cancel();
  }, [callActive, cancel]);

  const enable = useCallback(() => {
    setFailure(null);
    setDownloading(false);
    setAskedAt(null);
    spoken.current = { ...silentReply };
    queued.current = null;
    prime();
    setOn(true);
  }, [prime]);

  const disable = useCallback(() => {
    setOn(false);
    setDownloading(false);
    queued.current = null;
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
      : downloading
        ? "downloading"
        : speaking
          ? "speaking"
          : waiting || streaming
            ? "thinking"
            : listening
              ? "listening"
              : "starting";

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
