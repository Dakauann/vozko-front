"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { fetchWithRefresh, getApiBaseUrl, scopeHeaders } from "@/lib/api/browser-client";
import { createGoSignals, createScreenAnswerer, createScreenClaimer, createScreenRegistry, routeScreenCommand, type ReplyDelivery, type ScreenGo, type ScreenHandler, type ScreenReply, type ScreenTarget, type SubjectTarget } from "@/lib/aichat/screen";
import type { ChatMode, ChatView } from "@/lib/aichat/types";

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

let creator: ScreenHandler | null = null;

export function useProjectCreator(handler: ScreenHandler) {
  const latest = useRef(handler);

  useEffect(() => {
    latest.current = handler;
  }, [handler]);

  useEffect(() => {
    const run: ScreenHandler = (command) => latest.current(command);
    creator = run;
    return () => {
      if (creator === run) creator = null;
    };
  }, []);
}

async function postScreenClaim(threadId: string, commandId: string, claimant: string): Promise<boolean> {
  const url = `${getApiBaseUrl()}/chat/threads/${encodeURIComponent(threadId)}/screen/${encodeURIComponent(commandId)}/claim`;
  const res = await fetchWithRefresh(() =>
    fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...scopeHeaders() },
      body: JSON.stringify({ claimant }),
    }),
  );
  return res.ok;
}

const CLAIM_WAIT_MS = 15_000;
const goSignals = createGoSignals();

export const receiveScreenGo = (signal: ScreenGo) => goSignals.arrive(signal);

const claimScreenCommand = createScreenClaimer({ post: postScreenClaim, signals: goSignals, newClaimant: () => crypto.randomUUID(), waitMs: CLAIM_WAIT_MS });

export const answerScreenCommand = createScreenAnswerer({ run: (command) => routeScreenCommand(command, registry.run, creator), post: postScreenReply, claim: claimScreenCommand });

export type ProjectOpenOutcome = "delivered" | "resumed" | "ignored";

export interface ProjectOpenedNotice {
  view: ChatView;
  mode?: ChatMode;
  timezone: string;
}

export async function announceProjectOpened(threadId: string, notice: ProjectOpenedNotice): Promise<ProjectOpenOutcome | null> {
  try {
    const url = `${getApiBaseUrl()}/chat/threads/${encodeURIComponent(threadId)}/project-opened`;
    const res = await fetchWithRefresh(() =>
      fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...scopeHeaders() },
        body: JSON.stringify(notice),
      }),
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { outcome?: string };
    return body.outcome === "delivered" || body.outcome === "resumed" || body.outcome === "ignored" ? body.outcome : null;
  } catch {
    return null;
  }
}

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

export type ScreenReveal = (target: ScreenTarget) => void;

const reveals = new Map<string, ScreenReveal>();
const revealWatchers = new Set<() => void>();

function revealsChanged(): void {
  revealWatchers.forEach((watcher) => watcher());
}

function watchReveals(watcher: () => void): () => void {
  revealWatchers.add(watcher);
  return () => {
    revealWatchers.delete(watcher);
  };
}

export function useScreenReveal(projectId: string | null, reveal: ScreenReveal) {
  const latest = useRef(reveal);

  useEffect(() => {
    latest.current = reveal;
  }, [reveal]);

  useEffect(() => {
    if (!projectId) return;
    const handler: ScreenReveal = (target) => latest.current(target);
    reveals.set(projectId, handler);
    revealsChanged();
    return () => {
      if (reveals.get(projectId) === handler) reveals.delete(projectId);
      revealsChanged();
    };
  }, [projectId]);
}

export function useCanReveal(projectId: string | undefined): boolean {
  return useSyncExternalStore(
    watchReveals,
    () => Boolean(projectId && reveals.has(projectId)),
    () => false,
  );
}

export function revealOnScreen(target: SubjectTarget): boolean {
  const reveal = reveals.get(target.projectId);
  if (!reveal) return false;
  reveal(target);
  return true;
}
