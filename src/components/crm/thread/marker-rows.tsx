"use client";

import { useTranslations } from "next-intl";

import type { ThreadRow } from "@/lib/conversations/thread-rows";

import { DayLabel } from "./message-parts";

export function DayRow({ row }: { row: Extract<ThreadRow, { kind: "day" }> }) {
  return (
    <div data-day-header={row.dayKey} className="pointer-events-none sticky top-0 z-10 flex items-center justify-center py-3">
      <span className="pointer-events-auto rounded-lg bg-card px-3 py-1 text-2xs font-medium text-muted-foreground shadow-sm">
        <DayLabel iso={row.iso} />
      </span>
    </div>
  );
}

export function UnreadDividerRow({ row }: { row: Extract<ThreadRow, { kind: "unread-divider" }> }) {
  const t = useTranslations("crmConversation.thread");
  return (
    <div data-unread-divider={row.key} role="separator" aria-label={t("unreadDivider")} className="flex scroll-mt-14 items-center gap-3 py-2">
      <span aria-hidden="true" className="h-px flex-1 bg-border-strong" />
      <span className="text-2xs font-semibold text-foreground">{t("unreadDivider")}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-border-strong" />
    </div>
  );
}
