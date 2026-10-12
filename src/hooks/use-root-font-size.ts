"use client";

import { useSyncExternalStore } from "react";

const BROWSER_DEFAULT_FONT_PX = 16;

let measured: number | null = null;

function measure(): number {
  const size = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return size > 0 ? size : BROWSER_DEFAULT_FONT_PX;
}

function subscribe(onChange: () => void) {
  const update = () => {
    measured = measure();
    onChange();
  };
  measured = measure();
  window.addEventListener("resize", update);
  return () => window.removeEventListener("resize", update);
}

const read = () => (measured ??= measure());
const defaultOnServer = () => BROWSER_DEFAULT_FONT_PX;

export function useRootFontSize(): number {
  return useSyncExternalStore(subscribe, read, defaultOnServer);
}
