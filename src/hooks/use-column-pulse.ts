"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const COLUMN_PULSE_MS = 750;

export function useColumnPulse() {
  const [pulsing, setPulsing] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const pulse = useCallback((columnId: string) => {
    const existing = timers.current.get(columnId);
    if (existing) clearTimeout(existing);
    setPulsing((prev) => new Set(prev).add(columnId));
    const timer = setTimeout(() => {
      setPulsing((prev) => {
        const next = new Set(prev);
        next.delete(columnId);
        return next;
      });
      timers.current.delete(columnId);
    }, COLUMN_PULSE_MS);
    timers.current.set(columnId, timer);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
    };
  }, []);

  return { pulsing, pulse };
}
