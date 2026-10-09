"use client";

import { useCallback, useEffect, useState } from "react";

import { VIEWPORT_FILL_MIN_PX, documentTop, trailingInset, viewportFillHeight } from "@/lib/layout/viewport-fill";

export interface ViewportFill<T extends HTMLElement> {
  ref: (node: T | null) => void;
  height: string | undefined;
}

function fillOf(element: HTMLElement, minPx: number): string {
  return viewportFillHeight({ top: documentTop(element), bottom: trailingInset(element) }, minPx);
}

export function useViewportFill<T extends HTMLElement = HTMLDivElement>(minPx: number = VIEWPORT_FILL_MIN_PX): ViewportFill<T> {
  const [element, setElement] = useState<T | null>(null);
  const [height, setHeight] = useState<string | undefined>(undefined);

  const ref = useCallback(
    (node: T | null) => {
      setElement(node);
      if (node) setHeight(fillOf(node, minPx));
    },
    [minPx],
  );

  useEffect(() => {
    if (!element) return;
    const measure = () => setHeight(fillOf(element, minPx));
    window.addEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    return () => {
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [element, minPx]);

  return { ref, height };
}
