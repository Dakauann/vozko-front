"use client";

import { useEffect, useState } from "react";

export const ANCHOR_INSET = 12;
const ANCHOR_ATTEMPTS = 120;

export interface AnchorRect {
  top: number;
  right: number;
  bottom: number;
}

function same(current: AnchorRect | null, box: DOMRect): boolean {
  return Boolean(current && current.top === box.top && current.right === box.right && current.bottom === box.bottom);
}

export function useAnchorRect(selector: string): AnchorRect | null {
  const [rect, setRect] = useState<AnchorRect | null>(null);
  useEffect(() => {
    let element: HTMLElement | null = null;
    let frame = 0;
    let attempts = 0;
    const measure = () => {
      if (!element) return;
      const box = element.getBoundingClientRect();
      setRect((current) => (same(current, box) ? current : { top: box.top, right: box.right, bottom: box.bottom }));
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    const find = () => {
      element = document.querySelector<HTMLElement>(selector);
      if (element) {
        observer?.observe(element);
        measure();
        return;
      }
      if (++attempts < ANCHOR_ATTEMPTS) frame = requestAnimationFrame(find);
    };
    find();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [selector]);
  return rect;
}
