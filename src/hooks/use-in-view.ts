"use client";

import { useCallback, useRef, useState } from "react";

const DEFAULT_ROOT_MARGIN = "400px 0px";

export function useInView<T extends Element>(
  rootMargin: string = DEFAULT_ROOT_MARGIN,
): [(node: T | null) => void, boolean] {
  const [inView, setInView] = useState(
    () => typeof window !== "undefined" && typeof window.IntersectionObserver === "undefined",
  );
  const observer = useRef<IntersectionObserver | null>(null);

  const ref = useCallback(
    (node: T | null) => {
      observer.current?.disconnect();
      observer.current = null;
      if (!node || typeof IntersectionObserver === "undefined") return;

      const next = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          next.disconnect();
          setInView(true);
        },
        { rootMargin },
      );
      next.observe(node);
      observer.current = next;
    },
    [rootMargin],
  );

  return [ref, inView];
}
