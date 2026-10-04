"use client";

import { useLocale } from "next-intl";

import { emptyValue } from "@/lib/format/empty-value";
import { cn } from "@/lib/utils";

export function useEmptyValue(): string {
  return emptyValue(useLocale());
}

export function EmptyValue({ className }: { className?: string }) {
  return <span className={cn("text-muted-foreground", className)}>{useEmptyValue()}</span>;
}
