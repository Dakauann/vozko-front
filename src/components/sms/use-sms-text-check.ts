"use client";

import { checkSmsTextAction } from "@/app/actions/sms";
import { CHECK_SETTLE_MS, useDebouncedCheck, type DebouncedCheckState } from "@/lib/carrier-messaging/use-debounced-check";
import type { SmsTextCheck, SmsTextCheckRequest } from "@/lib/sms/types";

export type SmsTextCheckState = DebouncedCheckState<SmsTextCheck>;

export function useSmsTextCheck(text: string, routeId?: string, settleMs = CHECK_SETTLE_MS): SmsTextCheckState {
  const request: SmsTextCheckRequest | null = text.trim() ? (routeId ? { text, route_id: routeId } : { text }) : null;
  return useDebouncedCheck(request, checkSmsTextAction, settleMs);
}
