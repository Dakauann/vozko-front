"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { isEmailActionError, renderEmailAction } from "@/app/actions/email-campaigns";
import type { Document, Hint, Issue } from "@/lib/email-design/types";

export const PREVIEW_DELAY_MS = 1500;

interface PreviewState {
  html?: string;
  subject?: string;
  hints: Hint[];
  issues: Issue[];
  loading: boolean;
  failed: boolean;
}

function issuesOf(details: Record<string, unknown> | undefined): Issue[] {
  const raw = details?.issues;
  return Array.isArray(raw) ? (raw.filter((item) => typeof item === "object" && item !== null && typeof (item as Issue).code === "string") as Issue[]) : [];
}

export function useEmailPreview(document: Document | null, subject: string | undefined) {
  const [state, setState] = useState<PreviewState>({ hints: [], issues: [], loading: false, failed: false });
  const live = useRef({ document, subject });
  const sequence = useRef(0);

  useLayoutEffect(() => {
    live.current = { document, subject };
  });

  const request = useCallback(async () => {
    const { document: current, subject: currentSubject } = live.current;
    if (!current) return;
    const ticket = ++sequence.current;
    setState((previous) => ({ ...previous, loading: true }));
    const result = await renderEmailAction({ document: current, ...(currentSubject !== undefined ? { subject: currentSubject } : {}) });
    if (ticket !== sequence.current) return;
    if (isEmailActionError(result)) {
      const issues = issuesOf(result.details);
      setState((previous) => ({ ...previous, issues, loading: false, failed: issues.length === 0 }));
      return;
    }
    setState({ html: result.data.html, subject: result.data.subject || undefined, hints: result.data.hints ?? [], issues: [], loading: false, failed: false });
  }, []);

  useEffect(() => {
    if (!document) return;
    const timer = window.setTimeout(() => void request(), PREVIEW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [document, subject, request]);

  return { ...state, request };
}
