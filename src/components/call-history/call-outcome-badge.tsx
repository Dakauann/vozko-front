"use client";

import { useTranslations } from "next-intl";

import { outcomeTone, type OutcomeTone } from "@/lib/call-history/format";
import type { CallOutcome } from "@/lib/call-history/types";
import { cn } from "@/lib/utils";

const TONE_CLASSES: Record<OutcomeTone, { text: string; dot: string }> = {
  healthy: { text: "text-healthy-ink", dot: "bg-healthy" },
  live: { text: "text-primary-ink", dot: "bg-primary motion-safe:animate-dot-pulse" },
  warning: { text: "text-warning-ink", dot: "bg-warning" },
  destructive: { text: "text-destructive-ink", dot: "bg-destructive" },
  muted: { text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

export function CallOutcomeBadge({ outcome }: { outcome: CallOutcome }) {
  const t = useTranslations("callHistory.outcomes");
  const tone = TONE_CLASSES[outcomeTone(outcome)];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium", tone.text)}>
      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tone.dot)} />
      {t(outcome)}
    </span>
  );
}
