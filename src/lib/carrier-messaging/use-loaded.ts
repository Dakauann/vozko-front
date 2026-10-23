"use client";

import { useCallback, useEffect, useState } from "react";

import type { CodedRefusal } from "@/lib/api/coded-error";
import type { ParsedAnswer } from "@/lib/api/parsed-request";

export type Loaded<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "failed"; data: null; error: CodedRefusal }
  | { status: "ready"; data: T; error: null };

type Settled<T> = { token: string; data: T; error: null } | { token: string; data: null; error: CodedRefusal };

export function useLoaded<T>(load: (signal: AbortSignal) => Promise<ParsedAnswer<T>>, key = "") {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const token = `${key}#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).then((answer) => {
      if (controller.signal.aborted) return;
      setSettled(answer.error ? { token, data: null, error: answer.error } : { token, data: answer.data, error: null });
    });
    return () => controller.abort();
  }, [load, token]);

  const reload = useCallback(() => setAttempt((current) => current + 1), []);

  const update = useCallback(
    (change: (current: T) => T) =>
      setSettled((current) => (current && current.error === null ? { token: current.token, data: change(current.data), error: null } : current)),
    [],
  );

  const state: Loaded<T> =
    settled?.token !== token
      ? { status: "loading", data: null, error: null }
      : settled.error
        ? { status: "failed", data: null, error: settled.error }
        : { status: "ready", data: settled.data, error: null };

  return { ...state, reload, update };
}
