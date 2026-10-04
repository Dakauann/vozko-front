"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

const readWidth = () => window.innerWidth;
const serverWidth = () => 0;

export function useViewportWidth(): number {
  return useSyncExternalStore(subscribe, readWidth, serverWidth);
}
