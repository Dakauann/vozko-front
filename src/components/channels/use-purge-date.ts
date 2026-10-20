"use client";

import { useCallback } from "react";
import { useFormatter } from "next-intl";

export function usePurgeDate() {
  const format = useFormatter();
  return useCallback((iso: string) => format.dateTime(new Date(iso), { dateStyle: "long" }), [format]);
}

export function useCheckedDate() {
  const format = useFormatter();
  return useCallback((iso: string) => format.dateTime(new Date(iso), { dateStyle: "short", timeStyle: "short" }), [format]);
}
