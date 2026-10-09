"use client";

import type { ReactNode } from "react";

import { isBusySectionError } from "@/lib/analytics/section-query";

import { SectionError } from "./primitives";

export interface SectionQueryState {
  isError: boolean;
  error: unknown;
  isFetching: boolean;
  refetch: () => unknown;
}

export function SectionState({ query, children, message }: { query: SectionQueryState; children: ReactNode; message?: string }) {
  if (!query.isError) return <>{children}</>;
  return <SectionError busy={isBusySectionError(query.error)} onRetry={() => void query.refetch()} retrying={query.isFetching} message={message} />;
}
