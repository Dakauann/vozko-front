"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const BOTTOM_SLACK_PX = 48;

export type ScrollAnchor = "bottom" | "top";

export function useStickToBottom(content: unknown, conversationKey: unknown, anchor: ScrollAnchor = "bottom") {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(anchor === "bottom");
  const topRef = useRef(anchor === "top");
  const [showScrollDown, setShowScrollDown] = useState(false);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_SLACK_PX;
    stickRef.current = atBottom && !topRef.current;
    setShowScrollDown(!atBottom && !topRef.current);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stickRef.current = true;
    setShowScrollDown(false);
  }, []);

  useLayoutEffect(() => {
    stickRef.current = !topRef.current;
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [conversationKey]);

  useLayoutEffect(() => {
    topRef.current = anchor === "top";
    stickRef.current = !topRef.current;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = topRef.current ? 0 : el.scrollHeight;
  }, [anchor]);

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

  return { scrollRef, onScroll, showScrollDown: showScrollDown && anchor === "bottom", scrollToBottom };
}
