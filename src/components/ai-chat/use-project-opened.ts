"use client";

import { useEffect, useRef } from "react";

import type { ChatMode, ChatView } from "@/lib/aichat/types";
import { browserTimezone } from "@/lib/working-hours/types";

import { openThread } from "./chat-turns";
import { announceProjectOpened } from "./screen-bridge";

function openedKey(threadId: string | null, view: ChatView | undefined, bound: string | null): string | null {
  if (!threadId || view?.surface !== "studio" || !bound || view.projectId !== bound) return null;
  return `${threadId}:${bound}`;
}

interface Shown {
  threadId: string | null;
  view: ChatView | undefined;
  mode: ChatMode | undefined;
  key: string | null;
}

function announce({ threadId, view, mode, key }: Shown): void {
  if (!key || !threadId || !view) return;
  void announceProjectOpened(threadId, { view, mode, timezone: browserTimezone() }).then((outcome) => {
    if (outcome === "resumed") void openThread(threadId);
  });
}

export function useProjectOpenedNotice(threadId: string | null, view: ChatView | undefined, mode: ChatMode | undefined, bound: string | null) {
  const key = openedKey(threadId, view, bound);
  const latest = useRef<Shown>({ threadId, view, mode, key });
  const announced = useRef<string | null>(null);

  useEffect(() => {
    latest.current = { threadId, view, mode, key };
  }, [threadId, view, mode, key]);

  useEffect(() => {
    if (key === announced.current) return;
    announced.current = key;
    announce(latest.current);
  }, [key, threadId]);

  useEffect(() => {
    const visible = () => {
      if (document.visibilityState === "visible") announce(latest.current);
    };
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, []);
}
