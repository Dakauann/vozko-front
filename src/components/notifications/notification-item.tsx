"use client";

import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import type { MouseEvent, ReactNode } from "react";

import { StatusChip } from "@/components/elevated-design/status-chip";
import { ArrowRight, ArrowSquareOut, Check, EnvelopeSimple } from "@/components/icons";
import { Link } from "@/i18n/routing";
import { actionLinkKind } from "@/lib/notifications/broadcast";
import { isUnread } from "@/lib/notifications/inbox";
import type { NotificationItem } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

import { CATEGORY_ICON, SEVERITY_CHIP } from "./notification-visuals";

const ACTION_CLASS =
  "inline-flex min-w-0 items-center gap-1 rounded-[--radius] text-xs font-semibold text-primary-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ActionLink({
  item,
  preview,
  onFollow,
}: {
  item: NotificationItem;
  preview: boolean;
  onFollow: (event: MouseEvent) => void;
}) {
  const t = useTranslations("notifications.item");
  const kind = item.actionUrl ? actionLinkKind(item.actionUrl) : null;
  if (!item.actionUrl || !kind) return null;
  const label = item.actionLabel || t("open");
  const content: ReactNode = (
    <>
      <span className="truncate">{label}</span>
      {kind === "external" ? (
        <ArrowSquareOut aria-hidden className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <ArrowRight aria-hidden className="h-3.5 w-3.5 shrink-0" />
      )}
    </>
  );
  if (preview) return <span className={ACTION_CLASS}>{content}</span>;
  if (kind === "external") {
    return (
      <a href={item.actionUrl} target="_blank" rel="noopener noreferrer" className={ACTION_CLASS} onClick={onFollow}>
        {content}
        <span className="sr-only">{t("opensOutside")}</span>
      </a>
    );
  }
  return (
    <Link href={item.actionUrl} className={ACTION_CLASS} onClick={onFollow}>
      {content}
    </Link>
  );
}

export function NotificationItemView({
  item,
  now,
  onOpen,
  onToggleRead,
  onNavigate,
  preview = false,
}: {
  item: NotificationItem;
  now: Date;
  onOpen?: (item: NotificationItem) => void;
  onToggleRead?: (item: NotificationItem) => void;
  onNavigate?: () => void;
  preview?: boolean;
}) {
  const t = useTranslations("notifications");
  const format = useFormatter();
  const unread = isUnread(item);
  const CategoryGlyph = CATEGORY_ICON[item.category];
  const chipTone = SEVERITY_CHIP[item.severity];
  const interactive = !preview;

  const follow = (event: MouseEvent) => {
    event.stopPropagation();
    onOpen?.(item);
    onNavigate?.();
  };

  const toggle = (event: MouseEvent) => {
    event.stopPropagation();
    onToggleRead?.(item);
  };

  return (
    <article
      className={cn("group relative flex gap-3 px-4 py-3 transition-colors", interactive && onOpen && "cursor-pointer hover:bg-accent-hover")}
      onClick={interactive && onOpen ? () => onOpen(item) : undefined}
    >
      {unread ? (
        <span className="absolute left-1.5 top-[1.3rem] h-1.5 w-1.5 rounded-full bg-primary">
          <span className="sr-only">{t("item.unread")}</span>
        </span>
      ) : null}

      <span aria-hidden className="tile-neutral flex h-8 w-8 shrink-0 items-center justify-center">
        <CategoryGlyph className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <p
            className={cn(
              "min-w-0 flex-1 break-words text-sm leading-5 text-foreground line-clamp-2",
              unread ? "font-semibold" : "font-medium",
            )}
          >
            {item.title}
          </p>
          <time dateTime={item.createdAt} className="shrink-0 text-2xs leading-5 tabular-nums text-muted-foreground">
            {format.relativeTime(new Date(item.createdAt), now)}
          </time>
        </div>

        {item.body ? (
          <p className="mt-0.5 whitespace-pre-line break-words text-xs leading-relaxed text-muted-foreground line-clamp-3">{item.body}</p>
        ) : null}

        {item.imageUrl ? (
          <span className="relative mt-2 block aspect-[2/1] w-full overflow-hidden rounded-[--radius] border border-border bg-muted">
            <Image src={item.imageUrl} alt="" fill unoptimized sizes="400px" className="object-cover" />
          </span>
        ) : null}

        <div className="mt-1.5 flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-2xs font-medium text-muted-foreground">{t(`categories.${item.category}`)}</span>
          {chipTone ? <StatusChip tone={chipTone} label={t(`severity.${item.severity}`)} className="px-1.5 py-0 text-2xs" /> : null}
          <ActionLink item={item} preview={preview} onFollow={follow} />
          {interactive && onToggleRead ? (
            <button
              type="button"
              onClick={toggle}
              aria-label={unread ? t("item.markRead") : t("item.markUnread")}
              title={unread ? t("item.markRead") : t("item.markUnread")}
              className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            >
              {unread ? <Check className="h-3.5 w-3.5" /> : <EnvelopeSimple className="h-3.5 w-3.5" />}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
