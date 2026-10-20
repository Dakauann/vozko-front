"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { listConversationToolCallsAction } from "@/app/actions/conversations";
import { codedErrorOf, type CodedError } from "@/lib/api/coded-error";
import {
  applyToolCallsPage,
  emptyToolCalls,
  needsOlderToolCalls,
  nextToolCallsPage,
  type AgentToolCall,
  type ToolCallsPage,
  type ToolCallsState,
} from "@/lib/conversations/agent-tool-calls";

const PAGE_SIZE = 50;
const NEWEST_PAGE = 1;

interface ToolCallsFailure {
  page: number;
  error: CodedError;
}

interface EntryToolCalls {
  key: string | null;
  state: ToolCallsState;
  failure: ToolCallsFailure | null;
  newestAttempt: number;
  olderAttempt: number;
}

export interface ConversationToolCalls {
  calls: AgentToolCall[];
  failure: CodedError | null;
  retry: () => void;
}

type PageAnswer = Awaited<ReturnType<typeof listConversationToolCallsAction>>;

function emptyEntry(key: string | null): EntryToolCalls {
  return { key, state: emptyToolCalls, failure: null, newestAttempt: 0, olderAttempt: 0 };
}

function withPage(prev: EntryToolCalls, key: string, pageNumber: number, page: ToolCallsPage): EntryToolCalls {
  if (prev.key !== key) return prev;
  const failure = prev.failure?.page === pageNumber ? null : prev.failure;
  return { ...prev, state: applyToolCallsPage(prev.state, page), failure };
}

function withFailure(prev: EntryToolCalls, key: string, pageNumber: number, error: CodedError): EntryToolCalls {
  if (prev.key !== key) return prev;
  return { ...prev, failure: { page: pageNumber, error } };
}

function retried(prev: EntryToolCalls): EntryToolCalls {
  if (!prev.failure) return prev;
  if (prev.failure.page === NEWEST_PAGE) return { ...prev, failure: null, newestAttempt: prev.newestAttempt + 1 };
  return { ...prev, failure: null, olderAttempt: prev.olderAttempt + 1 };
}

function readPage(entryType: string, entryId: string, pageNumber: number): Promise<{ page: ToolCallsPage } | { error: CodedError }> {
  return listConversationToolCallsAction(entryType, entryId, { page: pageNumber, pageSize: PAGE_SIZE }).then(
    (result: PageAnswer) => (result.page ? { page: result.page } : { error: codedErrorOf({ message: result.error, code: result.code, status: result.status }) }),
    () => ({ error: {} }),
  );
}

export function useConversationToolCalls(
  entryId: string | null,
  entryType: string | null,
  oldestMessageAt: string | null,
  refreshKey: string | null,
): ConversationToolCalls {
  const key = entryId && entryType ? `${entryType}:${entryId}` : null;
  const [entry, setEntry] = useState<EntryToolCalls>(() => emptyEntry(key));
  const requested = useRef<{ key: string | null; pages: Set<number> }>({ key: null, pages: new Set() });

  const current = entry.key === key ? entry : emptyEntry(key);
  if (current !== entry) setEntry(current);
  const { newestAttempt, olderAttempt } = current;

  useEffect(() => {
    if (!key || !entryId || !entryType) return;
    let active = true;
    void readPage(entryType, entryId, NEWEST_PAGE).then((answer) => {
      if (!active) return;
      setEntry((prev) => ("page" in answer ? withPage(prev, key, NEWEST_PAGE, answer.page) : withFailure(prev, key, NEWEST_PAGE, answer.error)));
    });
    return () => {
      active = false;
    };
  }, [key, entryId, entryType, refreshKey, newestAttempt]);

  const olderPage = needsOlderToolCalls(current.state, oldestMessageAt) ? nextToolCallsPage(current.state) : null;

  useEffect(() => {
    if (!key || !entryId || !entryType || olderPage === null) return;
    if (requested.current.key !== key) requested.current = { key, pages: new Set() };
    if (requested.current.pages.has(olderPage)) return;
    requested.current.pages.add(olderPage);
    const asked = requested.current;
    void readPage(entryType, entryId, olderPage).then((answer) => {
      if ("page" in answer) {
        setEntry((prev) => withPage(prev, key, olderPage, answer.page));
        return;
      }
      asked.pages.delete(olderPage);
      setEntry((prev) => withFailure(prev, key, olderPage, answer.error));
    });
  }, [key, entryId, entryType, olderPage, olderAttempt]);

  const retry = useCallback(() => setEntry(retried), []);

  return { calls: current.state.calls, failure: current.failure?.error ?? null, retry };
}
