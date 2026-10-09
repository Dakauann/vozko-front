"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

import { startLeadActionAction } from "@/app/actions/lead-actions";
import { cancelLeadSendAction, reviewLeadSendAction, startLeadSendAction } from "@/app/actions/lead-sends";
import type { CodedError } from "@/lib/api/coded-error";
import { newIdempotencyKey } from "@/lib/api/idempotency-key";
import type { LeadActionPreview, LeadActionRequest } from "@/lib/leads/actions";
import { confirmedSelection } from "@/lib/leads/bulk-selection";
import { sendRequestOf, type SendReview } from "@/lib/leads/sends";
import { SELECTION_CHANGED } from "@/lib/selection/errors";

const PREPARING = "send_preparing";
const KEY_REUSED = "idempotency_key_reused";
const DEPARTMENT_REQUIRED = "send_department_required";
const ALREADY_STARTED = "send_already_started";
const BUDGET_REFUSALS: readonly string[] = ["unaffordable", "over_cap"];
const KEY_HOLDING_CODES: readonly string[] = [PREPARING, KEY_REUSED];
const RETRYABLE_STATUSES: readonly number[] = [408, 429];
const PREPARING_ATTEMPTS = 6;
const PREPARING_RETRY_MS = 2_000;
const EMPTY_ANSWER: CodedError = { message: "Empty response" };

export type PrepareOutcome = "ready" | "changed" | "department" | "failed";

export type LeadSendBusy = "preparing" | "starting" | null;

interface Prepared {
  signature: string;
  review: SendReview;
}

type PrepareAnswer = { send: SendReview; error: null } | { send: null; error: CodedError };

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function refusedBeforeAnyPart(error: CodedError): boolean {
  const status = error.status ?? 0;
  return status >= 400 && status < 500 && !RETRYABLE_STATUSES.includes(status) && !KEY_HOLDING_CODES.includes(error.code ?? "");
}

async function askToPrepare(body: LeadActionRequest, idempotencyKey: string, retryDelayMs: number): Promise<PrepareAnswer> {
  for (let attempt = 1; ; attempt++) {
    const answer = await startLeadActionAction(body, idempotencyKey);
    if (answer.error?.code === PREPARING && attempt < PREPARING_ATTEMPTS) {
      await wait(retryDelayMs);
      continue;
    }
    if (answer.error) return { send: null, error: answer.error };
    return answer.data.send ? { send: answer.data.send, error: null } : { send: null, error: EMPTY_ANSWER };
  }
}

async function settleKey(
  key: MutableRefObject<string | null>,
  unsettled: MutableRefObject<LeadActionRequest | null>,
  retryDelayMs: number,
): Promise<boolean> {
  const body = unsettled.current;
  const idempotencyKey = key.current;
  unsettled.current = null;
  key.current = null;
  if (!body || !idempotencyKey) return true;
  const answer = await askToPrepare(body, idempotencyKey, retryDelayMs);
  if (answer.error) return refusedBeforeAnyPart(answer.error) || answer.error.code === SELECTION_CHANGED;
  const cancelled = await cancelLeadSendAction(sendRequestOf(answer.send));
  return !cancelled.error;
}

export function useLeadSendFlow({
  retryDelayMs = PREPARING_RETRY_MS,
  onLeftBehind,
}: { retryDelayMs?: number; onLeftBehind?: () => void } = {}) {
  const key = useRef<string | null>(null);
  const unsettled = useRef<LeadActionRequest | null>(null);
  const prepared = useRef<Prepared | null>(null);
  const [review, setReview] = useState<SendReview | null>(null);
  const [busy, setBusy] = useState<LeadSendBusy>(null);
  const [failure, setFailure] = useState<CodedError | null>(null);

  const keep = useCallback((next: Prepared | null) => {
    prepared.current = next;
    setReview(next?.review ?? null);
  }, []);

  const keyOfOpening = () => {
    key.current ??= newIdempotencyKey();
    return key.current;
  };

  const release = useCallback(async (): Promise<CodedError | null> => {
    const current = prepared.current;
    if (!current || current.review.started) return null;
    prepared.current = null;
    const answer = await cancelLeadSendAction(sendRequestOf(current.review));
    if (answer.error && answer.error.code !== ALREADY_STARTED) {
      prepared.current = current;
      return answer.error;
    }
    keep(null);
    key.current = null;
    return null;
  }, [keep]);

  const prepare = useCallback(
    async (request: LeadActionRequest, preview: LeadActionPreview): Promise<PrepareOutcome> => {
      const signature = JSON.stringify(request);
      setFailure(null);
      if (prepared.current?.signature === signature) {
        setReview(prepared.current.review);
        return "ready";
      }
      setBusy("preparing");
      try {
        const refused = await release();
        if (refused) {
          setFailure(refused);
          return "failed";
        }
        const confirmed: LeadActionRequest = { ...request, selection: confirmedSelection(request.selection, preview.result) };
        if (unsettled.current && JSON.stringify(unsettled.current) !== JSON.stringify(confirmed)) {
          if (!(await settleKey(key, unsettled, retryDelayMs))) onLeftBehind?.();
        }
        unsettled.current = confirmed;
        let answer = await askToPrepare(confirmed, keyOfOpening(), retryDelayMs);
        if (answer.error?.code === KEY_REUSED) {
          key.current = null;
          onLeftBehind?.();
          answer = await askToPrepare(confirmed, keyOfOpening(), retryDelayMs);
        }
        if (answer.error) {
          if (refusedBeforeAnyPart(answer.error) || answer.error.code === SELECTION_CHANGED) unsettled.current = null;
          if (answer.error.code === SELECTION_CHANGED) return "changed";
          setFailure(answer.error);
          return answer.error.code === DEPARTMENT_REQUIRED ? "department" : "failed";
        }
        unsettled.current = null;
        keep({ signature, review: answer.send });
        return "ready";
      } finally {
        setBusy(null);
      }
    },
    [keep, release, retryDelayMs, onLeftBehind],
  );

  const refresh = useCallback(async () => {
    const current = prepared.current;
    if (!current) return;
    const answer = await reviewLeadSendAction(sendRequestOf(current.review));
    if (answer.data) keep({ ...current, review: answer.data });
  }, [keep]);

  const start = useCallback(
    async (firstN?: number): Promise<SendReview | null> => {
      const current = prepared.current;
      if (!current) return null;
      setBusy("starting");
      setFailure(null);
      try {
        const answer = await startLeadSendAction(sendRequestOf(current.review, firstN));
        if (answer.error) {
          if (BUDGET_REFUSALS.includes(answer.error.code ?? "")) await refresh();
          setFailure(answer.error);
          return null;
        }
        keep({ ...current, review: answer.data });
        return answer.data;
      } finally {
        setBusy(null);
      }
    },
    [keep, refresh],
  );

  const discard = useCallback(async (): Promise<boolean> => {
    if (!prepared.current) return settleKey(key, unsettled, retryDelayMs);
    if (await release()) return false;
    return settleKey(key, unsettled, retryDelayMs);
  }, [release, retryDelayMs]);

  useEffect(
    () => () => {
      const current = prepared.current;
      if (current && !current.review.started) void cancelLeadSendAction(sendRequestOf(current.review));
      if (unsettled.current) void settleKey(key, unsettled, retryDelayMs);
    },
    [retryDelayMs],
  );

  return { review, busy, failure, prepare, start, discard, clearFailure: () => setFailure(null) };
}
