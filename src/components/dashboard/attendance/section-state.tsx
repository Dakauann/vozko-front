"use client";

import type { ReactNode } from "react";

import { AttendanceSectionError } from "@/lib/attendance/sections";

import { SectionError } from "./primitives";

const BUSY_STATUS = 503;

export interface SectionQueryState {
  isError: boolean;
  error: unknown;
  isFetching: boolean;
  refetch: () => unknown;
}

export function SectionState({ query, children }: { query: SectionQueryState; children: ReactNode }) {
  if (!query.isError) return <>{children}</>;
  const busy = query.error instanceof AttendanceSectionError && query.error.status === BUSY_STATUS;
  return <SectionError busy={busy} onRetry={() => void query.refetch()} retrying={query.isFetching} />;
}
