"use client";

import { useEffect, useRef } from "react";

import { fetchWithRefresh, getApiBaseUrl, scopeHeaders } from "@/lib/api/browser-client";
import { createScreenAnswerer, createScreenRegistry, type ReplyDelivery, type ScreenHandler, type ScreenReply } from "@/lib/aichat/screen";

const registry = createScreenRegistry();

export function useScreenHandler(projectId: string | null, handler: ScreenHandler) {
  const latest = useRef(handler);

  useEffect(() => {
    latest.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!projectId) return;
    return registry.register(projectId, (command) => latest.current(command));
  }, [projectId]);
}

async function postScreenReply(threadId: string, commandId: string, reply: ScreenReply): Promise<ReplyDelivery> {
  const url = `${getApiBaseUrl()}/chat/threads/${encodeURIComponent(threadId)}/screen/${encodeURIComponent(commandId)}`;
  const res = await fetchWithRefresh(() =>
    fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...scopeHeaders() },
      body: JSON.stringify(reply),
    }),
  );
  if (res.ok) return "delivered";
  return res.status >= 500 || res.status === 429 ? "retry" : "gone";
}

export const answerScreenCommand = createScreenAnswerer({ run: registry.run, post: postScreenReply });

const stopHandlers = new Set<() => void>();

export function useScreenStop(stop: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    stopHandlers.add(stop);
    return () => {
      stopHandlers.delete(stop);
    };
  }, [stop, active]);
}

export function requestScreenStop(): boolean {
  stopHandlers.forEach((stop) => stop());
  return stopHandlers.size > 0;
}

const turnEndHandlers = new Set<() => void>();

export function useScreenTurnEnd(listener: () => void) {
  useEffect(() => {
    turnEndHandlers.add(listener);
    return () => {
      turnEndHandlers.delete(listener);
    };
  }, [listener]);
}

export function endScreenTurn(): void {
  turnEndHandlers.forEach((listener) => listener());
}
