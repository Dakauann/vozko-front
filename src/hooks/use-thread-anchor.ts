"use client";

import { useCallback, useLayoutEffect, useRef, type MutableRefObject, type RefObject } from "react";

import { firstVisibleIndex, isPinnedToBottom } from "@/lib/conversations/scroll-anchor";

const MESSAGE_SELECTOR = "[data-msg-id]";

interface Anchor {
  id: string;
  offset: number;
}

interface ThreadAnchorOptions {
  containerRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLElement | null>;
  pinnedRef: MutableRefObject<boolean>;
  lockedRef: MutableRefObject<boolean>;
  threadKey: string | undefined;
}

function offsetWithin(container: HTMLElement, element: Element): number {
  return element.getBoundingClientRect().top - container.getBoundingClientRect().top;
}

function captureAnchor(container: HTMLElement): Anchor | null {
  const messages = container.querySelectorAll<HTMLElement>(MESSAGE_SELECTOR);
  const viewportTop = container.getBoundingClientRect().top;
  const index = firstVisibleIndex(messages.length, (i) => messages[i].getBoundingClientRect().bottom, viewportTop);
  if (index < 0) return null;
  const element = messages[index];
  const id = element.dataset.msgId;
  return id ? { id, offset: offsetWithin(container, element) } : null;
}

function findMessage(container: HTMLElement, id: string): Element | null {
  return container.querySelector(`[data-msg-id="${CSS.escape(id)}"]`);
}

export function useThreadAnchor({ containerRef, contentRef, pinnedRef, lockedRef, threadKey }: ThreadAnchorOptions) {
  const anchorRef = useRef<Anchor | null>(null);

  const track = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    pinnedRef.current = isPinnedToBottom(container);
    anchorRef.current = pinnedRef.current ? null : captureAnchor(container);
  }, [containerRef, pinnedRef]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content || typeof ResizeObserver === "undefined") return;

    const hold = () => {
      if (lockedRef.current) return;
      if (pinnedRef.current) {
        container.scrollTo({ top: container.scrollHeight, behavior: "instant" });
        return;
      }
      const anchor = anchorRef.current;
      const element = anchor ? findMessage(container, anchor.id) : null;
      if (!anchor || !element) return;
      const shift = offsetWithin(container, element) - anchor.offset;
      if (shift !== 0) {
        container.scrollTo({ top: container.scrollTop + shift, behavior: "instant" });
      }
    };

    const observer = new ResizeObserver(hold);
    observer.observe(content);
    return () => observer.disconnect();
  }, [containerRef, contentRef, lockedRef, pinnedRef, threadKey]);

  return track;
}
