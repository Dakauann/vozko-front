"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { StatusChip } from "@/components/elevated-design/status-chip";
import { ArrowsClockwise, CircleNotch } from "@/components/icons";
import type { DebouncedCheckStatus } from "@/lib/carrier-messaging/use-debounced-check";

export function CheckPill({
  status,
  label,
  icon,
  failure,
  onRetry,
}: {
  status: DebouncedCheckStatus;
  label: string | null;
  icon: ReactNode;
  failure: string;
  onRetry: () => void;
}) {
  const t = useTranslations("carrierMessaging.check");

  if (status === "idle") return null;

  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <StatusChip tone="muted" label={failure} />
        <button
          type="button"
          onClick={onRetry}
          aria-label={t("retry")}
          title={t("retry")}
          className="inline-flex h-6 w-6 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowsClockwise aria-hidden className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  if (!label) {
    return <StatusChip tone="outline" label={t("checking")} icon={<CircleNotch aria-hidden className="h-3 w-3 animate-spin" />} />;
  }

  return (
    <span aria-live="polite" aria-busy={status === "checking"} className="inline-flex">
      <StatusChip
        tone="outline"
        label={label}
        icon={status === "checking" ? <CircleNotch aria-hidden className="h-3 w-3 animate-spin text-muted-foreground" /> : icon}
        className="tabular-nums"
      />
    </span>
  );
}
