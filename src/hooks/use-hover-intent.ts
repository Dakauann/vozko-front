"use client";

import { useCallback, useEffect, useRef } from "react";

export const HOVER_INTENT_MS = 150;

export function useHoverIntent<T>(onIntent: ((value: T) => void) | undefined, delayMs = HOVER_INTENT_MS) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentRef = useRef(onIntent);

  useEffect(() => {
    intentRef.current = onIntent;
  }, [onIntent]);

  const cancel = useCallback(() => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const start = useCallback(
    (value: T) => {
      cancel();
      if (!intentRef.current) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        intentRef.current?.(value);
      }, delayMs);
    },
    [cancel, delayMs],
  );

  useEffect(() => cancel, [cancel]);

  return { start, cancel };
}
