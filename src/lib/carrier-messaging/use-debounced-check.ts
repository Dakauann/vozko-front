"use client";

import { useCallback, useEffect, useState } from "react";

import type { ParsedAnswer } from "@/lib/api/parsed-request";
import type { CodedRefusal } from "@/lib/api/coded-error";

export type DebouncedCheckStatus = "idle" | "checking" | "ready" | "failed";

export interface DebouncedCheckState<T> {
  status: DebouncedCheckStatus;
  check: T | null;
  error: CodedRefusal | null;
  retry: () => void;
}

export const CHECK_SETTLE_MS = 450;

type Settled<T> = { key: string; check: T; error: null } | { key: string; check: null; error: CodedRefusal };

export function useDebouncedCheck<Request, T>(
  request: Request | null,
  ask: (request: Request, signal: AbortSignal) => Promise<ParsedAnswer<T>>,
  settleMs = CHECK_SETTLE_MS,
): DebouncedCheckState<T> {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [lastCheck, setLastCheck] = useState<T | null>(null);
  const body = request === null ? null : JSON.stringify(request);
  const key = `${attempt}:${body}`;

  useEffect(() => {
    if (body === null) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void ask(JSON.parse(body) as Request, controller.signal).then((answer) => {
        if (controller.signal.aborted) return;
        if (answer.error) {
          setSettled({ key, check: null, error: answer.error });
          return;
        }
        setSettled({ key, check: answer.data, error: null });
        setLastCheck(answer.data);
      });
    }, settleMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [ask, body, key, settleMs]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  if (body === null) return { status: "idle", check: null, error: null, retry };
  if (settled?.key !== key) return { status: "checking", check: lastCheck, error: null, retry };
  if (settled.error) return { status: "failed", check: lastCheck, error: settled.error, retry };
  return { status: "ready", check: settled.check, error: null, retry };
}
