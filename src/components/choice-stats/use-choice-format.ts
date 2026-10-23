"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";

import { localeTagFor } from "@/components/dashboard/attendance/primitives";
import { formatBasisPoints } from "@/lib/format/basis-points";

export interface ChoiceFormat {
  count: (value: number) => string;
  rate: (basisPoints: number, fractionDigits?: number) => string;
  day: (calendarDay: string) => string;
}

export function useChoiceFormat(): ChoiceFormat {
  const tag = localeTagFor(useLocale());
  return useMemo(
    () => ({
      count: (value) => value.toLocaleString(tag),
      rate: (basisPoints, fractionDigits = 1) => formatBasisPoints(basisPoints, tag, fractionDigits),
      day: (calendarDay) => new Intl.DateTimeFormat(tag, { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${calendarDay}T00:00:00Z`)),
    }),
    [tag],
  );
}
