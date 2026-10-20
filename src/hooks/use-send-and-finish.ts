"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Outbox } from "@/lib/conversations/outbox";
import { finishDecision, watchFinish, type FinishWatch } from "@/lib/conversations/send-and-finish";
import type { EntryType } from "@/lib/conversations/types";

interface FinishRequest {
  entryId: string;
  entryType: EntryType;
  watch: FinishWatch | null;
}

interface SendAndFinishOptions {
  outbox: Outbox;
  onFinish: (entryId: string, entryType: EntryType) => void;
  onAbandon: () => void;
}

export function useSendAndFinish({ outbox, onFinish, onAbandon }: SendAndFinishOptions) {
  const [request, setRequest] = useState<FinishRequest | null>(null);
  const handledRef = useRef<FinishWatch | null>(null);
  const callbacksRef = useRef({ onFinish, onAbandon });

  useEffect(() => {
    callbacksRef.current = { onFinish, onAbandon };
  }, [onFinish, onAbandon]);

  if (request && !request.watch) {
    setRequest({ ...request, watch: watchFinish(outbox, request.entryId, request.entryType) });
  }

  const watch = request?.watch ?? null;
  const decision = watch ? finishDecision(outbox, watch) : "wait";

  useEffect(() => {
    if (!watch || decision === "wait" || handledRef.current === watch) return;
    handledRef.current = watch;
    if (decision === "finish") callbacksRef.current.onFinish(watch.entryId, watch.entryType);
    else callbacksRef.current.onAbandon();
  }, [decision, watch]);

  return useCallback((entryId: string, entryType: EntryType) => setRequest({ entryId, entryType, watch: null }), []);
}
