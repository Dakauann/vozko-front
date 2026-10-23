"use client";

import { useCallback } from "react";
import { useFormatter } from "next-intl";

import { useEmptyValue } from "@/components/elevated-design/empty-value";
import { useWorkspace } from "@/contexts/workspace-context";
import type { ParsedAnswer } from "@/lib/api/parsed-request";
import { SectionError, sectionRetryDelay, shouldRetrySection } from "@/lib/analytics/section-query";
import type { SpendChannel } from "@/lib/carrier-messaging/analytics";

export const CARRIER_QUERY_OPTIONS = {
  retry: shouldRetrySection,
  retryDelay: sectionRetryDelay,
  refetchOnWindowFocus: true,
  refetchIntervalInBackground: false,
} as const;

export const LIVE_REFRESH_MS = 5_000;

export const CHANNEL_COLOR: Record<SpendChannel, string> = {
  rcs: "hsl(var(--chart-1))",
  sms: "hsl(var(--chart-2))",
  whatsapp: "hsl(var(--chart-3))",
};

export function answerOrThrow<T>(answer: ParsedAnswer<T>): T {
  if (answer.error) throw new SectionError(answer.error.code ?? answer.error.message ?? "request failed", answer.error.status, answer.error.code);
  return answer.data;
}

export function useCarrierWorkspaceId(): string {
  const { currentWorkspace } = useWorkspace();
  return currentWorkspace?.id ?? "";
}

export function useRateText() {
  const format = useFormatter();
  const empty = useEmptyValue();
  return useCallback(
    (rate: number | null | undefined) => (rate === null || rate === undefined ? empty : format.number(rate, { style: "percent", maximumFractionDigits: 1 })),
    [format, empty],
  );
}

export function useCountText() {
  const format = useFormatter();
  return useCallback((value: number) => format.number(value), [format]);
}
