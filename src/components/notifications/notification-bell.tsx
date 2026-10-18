"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Bell } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotificationRealtime, useNotificationSummary } from "@/hooks/use-notifications";
import { unreadBadgeLabel } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

import { NotificationPanel } from "./notification-panel";

export function NotificationBell() {
  const t = useTranslations("notifications.bell");
  const summary = useNotificationSummary();
  const [open, setOpen] = useState(false);
  useNotificationRealtime();

  const unread = summary.data?.unread ?? 0;
  const capped = summary.data?.capped ?? false;
  const badge = unreadBadgeLabel(unread, capped);
  const label = badge
    ? `${t("label")}, ${capped ? t("unreadCapped", { count: unread }) : t("unread", { count: unread })}`
    : t("label");

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (next) void summary.refetch();
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={t("label")}
          className={cn(
            "relative flex h-8 w-8 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            open && "bg-muted text-foreground",
          )}
        >
          <Bell className="h-4 w-4" />
          {badge ? (
            <span
              aria-hidden
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none tabular-nums text-primary-foreground ring-2 ring-sidebar"
            >
              {badge}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={8}
        aria-label={t("label")}
        className="flex max-h-[min(38rem,calc(100dvh-5rem))] w-[min(26rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-lg p-0"
      >
        <NotificationPanel summary={summary.data} onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
