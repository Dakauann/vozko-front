"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AnalyzedComment, CommentSource } from "@/lib/comment-analysis/types";

/*
 * The live comment feed's client half (§7).
 *
 * A small socket of its own rather than the CRM's: the comment-analysis tab is
 * a different page and holds no conversation state, so reusing the inbox hook
 * would pull an inbox, a search index and a subscription model onto a screen
 * that wants one event type.
 *
 * Buffering, not rendering, is this hook's job. While the view is paused (the
 * default) rows queue and only a count is shown, because a list that reorders
 * under the cursor makes the operator click the wrong row. While it is live
 * they are handed over as they arrive, straight from the socket callback: the
 * socket IS the external system, so that is where the delivery belongs rather
 * than in an effect watching a buffer.
 */

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000";

/** Mirrors `comment_analysis.CommentAnalyzed`. */
export interface LiveAnalyzedComment {
  commentId: string;
  workspaceId: string;
  source: CommentSource;
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
  commentedAt: string;
  analyzedAt: string;
}

interface LiveBatch {
  workspaceId: string;
  source: CommentSource;
  accountId: string;
  containerId: string;
  items: LiveAnalyzedComment[];
  /** How many the server classified in the same batch but did not send. */
  more: number;
}

/** The most the buffer holds before dropping the oldest. */
const MAX_BUFFERED = 100;

export function useCommentAnalysisLive({
  accountId,
  paused,
  onRows,
  enabled = true,
}: {
  accountId: string;
  /** While paused, rows queue instead of being delivered. */
  paused: boolean;
  /** Called with fresh rows as they arrive, only while not paused. */
  onRows: (rows: LiveAnalyzedComment[]) => void;
  enabled?: boolean;
}) {
  const [connected, setConnected] = useState(false);
  const [buffered, setBuffered] = useState<LiveAnalyzedComment[]>([]);
  // Counted separately from the buffer's length: a burst that overflowed the
  // buffer still analysed everything, and the badge must not understate it.
  const [analysedSinceDrain, setAnalysedSinceDrain] = useState(0);

  // The buffer is mirrored in a ref so draining reads it directly. Reading
  // state from inside a setState updater would run twice under StrictMode and
  // hand the same rows to the view twice.
  const bufferRef = useRef<LiveAnalyzedComment[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const closedRef = useRef(false);

  // Held in refs so a re-render does not tear the socket down and reconnect,
  // and written in an effect rather than during render: a ref assignment in
  // the render body runs on a pass React may throw away.
  const pausedRef = useRef(paused);
  const onRowsRef = useRef(onRows);
  useEffect(() => {
    pausedRef.current = paused;
    onRowsRef.current = onRows;
  }, [paused, onRows]);

  useEffect(() => {
    if (!enabled || !accountId) return;
    closedRef.current = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (closedRef.current) return;
      // Auth rides the httpOnly cookie on the handshake, as it does for the
      // conversation socket; nothing sensitive goes in the URL.
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
        if (parsed.type !== "comment_analysis:analyzed" || !parsed.payload) return;

        const batch = parsed.payload;
        // One socket carries the whole workspace; this view is one account.
        if (batch.accountId !== accountId) return;

        const items = batch.items ?? [];
        const seen = new Set(bufferRef.current.map((c) => c.commentId));
        const fresh = items.filter((c) => !seen.has(c.commentId));
        if (fresh.length === 0 && !batch.more) return;

        if (!pausedRef.current) {
          // Live: hand them straight over. Nothing queues, so nothing has to
          // be counted or drained.
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
        // Backoff, capped: a ticker is not worth hammering a socket for.
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

  /** Hands the buffered rows to the view and empties the buffer. */
  const drain = useCallback(() => {
    const taken = bufferRef.current;
    bufferRef.current = [];
    setBuffered([]);
    setAnalysedSinceDrain(0);
    return taken;
  }, []);

  return { connected, buffered, analysedSinceDrain, drain };
}
