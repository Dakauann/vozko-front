"use client";

import { useEffect, useRef, useState } from "react";

const NEXT_PAGE_ROOT_MARGIN = "400px 0px";

export interface NextPageOnView {
  hasNextPage: boolean;
  busy: boolean;
  auto: boolean;
  pageCount: number;
  fetchNextPage: () => unknown;
}

export function useNextPageOnView<T extends Element>({ hasNextPage, busy, auto, pageCount, fetchNextPage }: NextPageOnView) {
  const [node, setNode] = useState<T | null>(null);
  const fetchRef = useRef(fetchNextPage);

  useEffect(() => {
    fetchRef.current = fetchNextPage;
  }, [fetchNextPage]);

  useEffect(() => {
    if (!node || !auto || !hasNextPage || busy || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void fetchRef.current();
      },
      { rootMargin: NEXT_PAGE_ROOT_MARGIN },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, auto, hasNextPage, busy, pageCount]);

  return setNode;
}
