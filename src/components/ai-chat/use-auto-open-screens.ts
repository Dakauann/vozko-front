"use client";

import { useCallback, useSyncExternalStore } from "react";

export type AutoOpenPreference = "ask" | "on" | "off";

const STORAGE_KEY = "ai-chat:auto-open-screens";
const listeners = new Set<() => void>();
let sessionChoice: AutoOpenPreference = "ask";

function parse(value: string | null): AutoOpenPreference {
  return value === "on" || value === "off" ? value : "ask";
}

function read(): AutoOpenPreference {
  try {
    return parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return sessionChoice;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAutoOpenScreens() {
  const preference = useSyncExternalStore(subscribe, read, () => "ask" as AutoOpenPreference);
  const choose = useCallback((next: "on" | "off") => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      sessionChoice = next;
    }
    listeners.forEach((listener) => listener());
  }, []);
  return { preference, choose };
}
