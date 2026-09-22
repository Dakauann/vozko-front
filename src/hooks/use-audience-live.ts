"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AnalyzedComment, AudienceSource, SubjectKind } from "@/lib/audience/types";


const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000";

export interface LiveAnalyzedComment {
  commentId: string;
  subjectKind: SubjectKind;
  workspaceId: string;
  source: AudienceSource;
  accountId: string;
  containerId: string;
  authorExternalId: string;
  authorHandle?: string;
  stance?: AnalyzedComment["stance"];
  sentiment?: AnalyzedComment["sentiment"];
  intent?: AnalyzedComment["intent"];
  topicKey?: string;
  severity: number;
  requiresAction: boolean;
  isSpam: boolean;
  excerpt: string;
  interest?: AnalyzedComment["interest"];
  productInterest?: string;
  disposition?: AnalyzedComment["disposition"];
  qualification?: AnalyzedComment["qualification"];
  nextAction?: AnalyzedComment["nextAction"];
  summary?: string;
  attendanceQuality?: number;
  messageCount?: number;
  occurredAt: string;
  analyzedAt: string;
}

interface LiveBatch {
  workspaceId: string;
  source: AudienceSource;
  accountId: string;
  containerId: string;
  items: LiveAnalyzedComment[];
  more: number;
}

const MAX_BUFFERED = 100;

export function useCommentAnalysisLive({
  accountId,
  paused,
  onRows,
  enabled = true,
}: {
  accountId: string;
  paused: boolean;
  onRows: (rows: LiveAnalyzedComment[]) => void;
  enabled?: boolean;
}) {
  const [connected, setConnected] = useState(false);
  const [buffered, setBuffered] = useState<LiveAnalyzedComment[]>([]);
  const [analysedSinceDrain, setAnalysedSinceDrain] = useState(0);

  const bufferRef = useRef<LiveAnalyzedComment[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const closedRef = useRef(false);

  const pausedRef = useRef(paused);
  const onRowsRef = useRef(onRows);
  useEffect(() => {
    pausedRef.current = paused;
    onRowsRef.current = onRows;
  }, [paused, onRows]);

  useEffect(() => {
    if (!enabled) return;
    closedRef.current = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (closedRef.current) return;
      const params = new URLSearchParams();
      const workspaceId = document.cookie.match(/(?:^|;\s*)workspaceId=([^;]*)/)?.[1];
      if (workspaceId) params.set("workspaceId", decodeURIComponent(workspaceId));

      const socket = new WebSocket(`${WS_BASE_URL}/ws/conversations?${params.toString()}`);
      socketRef.current = socket;

      socket.onopen = () => {
        retryRef.current = 0;
        setConnected(true);
      };

      socket.onmessage = (event) => {
        let parsed: { type?: string; payload?: LiveBatch };
        try {
          parsed = JSON.parse(event.data as string);
        } catch {
          return;
        }
        if (parsed.type !== "audience:analyzed" || !parsed.payload) return;

        const batch = parsed.payload;
        if (accountId && batch.accountId !== accountId) return;

        const items = batch.items ?? [];
        const seen = new Set(bufferRef.current.map((c) => c.commentId));
        const fresh = items.filter((c) => !seen.has(c.commentId));
        if (fresh.length === 0 && !batch.more) return;

        if (!pausedRef.current) {
          if (fresh.length > 0) onRowsRef.current(fresh);
          return;
        }
        bufferRef.current = [...fresh, ...bufferRef.current].slice(0, MAX_BUFFERED);
        setBuffered(bufferRef.current);
        setAnalysedSinceDrain((n) => n + items.length + (batch.more ?? 0));
      };

      socket.onclose = () => {
        setConnected(false);
        socketRef.current = null;
        if (closedRef.current) return;
        const delay = Math.min(1000 * 2 ** retryRef.current, 30_000);
        retryRef.current += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => socket.close();
    };

    connect();
    return () => {
      closedRef.current = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [accountId, enabled]);

  const drain = useCallback(() => {
    const taken = bufferRef.current;
    bufferRef.current = [];
    setBuffered([]);
    setAnalysedSinceDrain(0);
    return taken;
  }, []);

  return { connected, buffered, analysedSinceDrain, drain };
}
