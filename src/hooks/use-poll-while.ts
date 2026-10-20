"use client";

import { useEffect, useRef } from "react";

import { pollUntil, type PollAnswer } from "@/lib/polling";

const DEFAULT_MAX_POLLS = 720;

function isValue<T, E>(answer: PollAnswer<T, E>): answer is { data: T; error: null } {
  return answer.error === null;
}

interface PollWhileOptions<T, E> {
  active: boolean;
  pollKey: string;
  read: () => Promise<PollAnswer<T, E>>;
  isOver: (value: T) => boolean;
  onValue: (value: T) => void;
  maxPolls?: number;
}

export function usePollWhile<T, E>({ active, pollKey, read, isOver, onValue, maxPolls = DEFAULT_MAX_POLLS }: PollWhileOptions<T, E>) {
  const latest = useRef({ read, isOver, onValue });
  useEffect(() => {
    latest.current = { read, isOver, onValue };
  }, [read, isOver, onValue]);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const watchedRead = async () => {
      const answer = await latest.current.read();
      if (!controller.signal.aborted && isValue(answer)) latest.current.onValue(answer.data);
      return answer;
    };
    void pollUntil(watchedRead, (value) => latest.current.isOver(value), { maxPolls, signal: controller.signal });
    return () => controller.abort();
  }, [active, pollKey, maxPolls]);
}
