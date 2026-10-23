"use client";

import { checkRcsContentAction } from "@/app/actions/rcs";
import { CHECK_SETTLE_MS, useDebouncedCheck, type DebouncedCheckState, type DebouncedCheckStatus } from "@/lib/carrier-messaging/use-debounced-check";
import type { RcsContent, RcsContentCheck, RcsContentCheckRequest } from "@/lib/rcs/types";

export type RcsContentCheckStatus = DebouncedCheckStatus;

export type RcsContentCheckState = DebouncedCheckState<RcsContentCheck>;

function hasSomething(content: RcsContent): boolean {
  return Boolean(content.text?.trim() || content.media || content.cards?.length || content.suggestions?.length);
}

export function useRcsContentCheck(content: RcsContent, settleMs = CHECK_SETTLE_MS): RcsContentCheckState {
  const request: RcsContentCheckRequest | null = hasSomething(content) ? { content } : null;
  return useDebouncedCheck(request, checkRcsContentAction, settleMs);
}
