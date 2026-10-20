"use client";

import { useSyncExternalStore } from "react";

const MINUTE_MS = 60_000;

let now = Date.now();
let timer: ReturnType<typeof setTimeout> | null = null;
const readers = new Set<() => void>();

function scheduleTick(): void {
  timer = setTimeout(() => {
    now = Date.now();
    readers.forEach((reader) => reader());
    scheduleTick();
  }, MINUTE_MS - (Date.now() % MINUTE_MS));
}

function subscribe(reader: () => void): () => void {
  readers.add(reader);
  if (readers.size === 1) {
    now = Date.now();
    scheduleTick();
  }
  return () => {
    readers.delete(reader);
    if (readers.size > 0 || !timer) return;
    clearTimeout(timer);
    timer = null;
  };
}

function snapshot(): number {
  return now;
}

export function useMinuteClock(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
