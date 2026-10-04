"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { WidgetStatus } from "@/lib/webchat/types";

const STATUS_COLORS: Record<WidgetStatus, string> = {
  active: "bg-healthy text-healthy-foreground",
  paused: "bg-muted text-muted-foreground",
};

export function WebchatStatusChip({ status }: { status: WidgetStatus }) {
  const t = useTranslations("webchat.status");
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-[--radius] px-2.5 py-0.5 text-xs font-medium",
        STATUS_COLORS[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {t(status)}
    </span>
  );
}
