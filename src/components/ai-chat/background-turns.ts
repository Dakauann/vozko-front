"use client";

import { useEffect, useSyncExternalStore } from "react";

import { chatTurns } from "@/lib/aichat/turn-store";

import { closeTurns } from "./chat-turns";

const NOTHING_LIVE: readonly string[] = Object.freeze([]);

export function useLiveThreads(): readonly string[] {
  return useSyncExternalStore(chatTurns.subscribe, chatTurns.live, () => NOTHING_LIVE);
}

export function useTurnLifetime(): void {
  useEffect(() => closeTurns, []);
}
