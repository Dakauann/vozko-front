"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const BOTTOM_SLACK_PX = 48;

export function useStickToBottom(content: unknown, conversationKey: unknown) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_SLACK_PX;
    stickRef.current = atBottom;
    setShowScrollDown(!atBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stickRef.current = true;
    setShowScrollDown(false);
  }, []);

  useLayoutEffect(() => {
    stickRef.current = true;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversationKey]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [content]);

  useEffect(() => {
    const el = scrollRef.current;
    const body = el?.firstElementChild;
    if (!el || !body || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (stickRef.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(body);
    return () => observer.disconnect();
  }, [conversationKey]);

  return { scrollRef, onScroll, showScrollDown, scrollToBottom };
}
