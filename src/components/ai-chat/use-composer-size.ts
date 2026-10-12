"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { useDragResize } from "@/hooks/use-drag-resize";
import { useRootFontSize } from "@/hooks/use-root-font-size";
import { useViewportHeight } from "@/hooks/use-viewport-width";
import {
  DEFAULT_COMPOSER_LINES,
  MIN_COMPOSER_LINES,
  clampComposerHeight,
  composerBoxHeight,
  composerLine,
  composerLines,
  composerMaxHeight,
} from "@/lib/aichat/composer-height";
import { localStore, readStoredSize, writeStoredSize } from "@/lib/stored-size";

const HEIGHT_KEY = "assistant-composer:height";

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

const readRemembered = () => readStoredSize(localStore(), HEIGHT_KEY);
const nothingOnServer = () => null;
const remember = (height: number) => writeStoredSize(localStore(), HEIGHT_KEY, height);

export function useComposerSize(content: string) {
  const field = useRef<HTMLTextAreaElement>(null);
  const mirror = useRef<HTMLTextAreaElement>(null);
  const viewport = useViewportHeight();
  const rem = useRootFontSize();
  const remembered = useSyncExternalStore(subscribeStorage, readRemembered, nothingOnServer);
  const [chosen, setChosen] = useState<number | null>(null);
  const height = clampComposerHeight(chosen ?? remembered ?? composerLines(DEFAULT_COMPOSER_LINES, rem), viewport, rem);
  const shown = useRef(height);

  const fit = useCallback(() => {
    const box = field.current;
    const probe = mirror.current;
    if (!box || !probe) return;
    const next = composerBoxHeight(probe.scrollHeight, height, viewport, rem);
    box.style.height = `${next}px`;
    shown.current = next;
  }, [height, viewport, rem]);

  const latestFit = useRef(fit);
  useLayoutEffect(() => {
    latestFit.current = fit;
    fit();
  }, [fit, content]);

  useEffect(() => {
    const probe = mirror.current;
    if (!probe) return;
    let width = probe.clientWidth;
    const observer = new ResizeObserver(() => {
      if (probe.clientWidth === width) return;
      width = probe.clientWidth;
      latestFit.current();
    });
    observer.observe(probe);
    return () => observer.disconnect();
  }, []);

  const read = useCallback(() => shown.current, []);
  const resizeTo = useCallback(
    (next: number) => {
      const value = clampComposerHeight(next, window.innerHeight, rem);
      setChosen(value);
      return value;
    },
    [rem],
  );
  const { resizing, handleProps } = useDragResize({ edge: "top", step: composerLine(rem), read, resizeTo, commit: remember });

  return {
    field,
    mirror,
    resize: {
      height,
      min: composerLines(MIN_COMPOSER_LINES, rem),
      max: composerMaxHeight(viewport, rem),
      resizing,
      handleProps,
    },
  };
}

export type ComposerResize = ReturnType<typeof useComposerSize>["resize"];
