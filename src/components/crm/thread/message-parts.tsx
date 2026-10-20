"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Check, Checks, Warning as WarningIcon } from "@/components/icons";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import FormattedMessageText from "@/components/ui/formatted-message-text";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { deliveryErrorFrom, deliveryErrorKey } from "@/lib/conversations/delivery-errors";
import { dayLabel, fullDateTime, messageTime, readAtLabel } from "@/lib/conversations/thread-labels";
import type { ConversationMessage } from "@/lib/conversations/types";
import { cn } from "@/lib/utils";

export function MessageTime({ iso }: { iso: string }) {
  const locale = useLocale();
  const time = messageTime(iso, locale);
  return time ? <>{time}</> : <EmptyValue />;
}

export function DayLabel({ iso }: { iso: string }) {
  const locale = useLocale();
  const t = useTranslations("crmConversation.thread");
  const label = dayLabel(iso, new Date(), locale);
  if (label.kind === "today") return <>{t("today")}</>;
  if (label.kind === "yesterday") return <>{t("yesterday")}</>;
  if (label.kind === "date") return <>{label.text}</>;
  return <EmptyValue />;
}

export function MessageTimestamp({ message, outgoing }: { message: ConversationMessage; outgoing: boolean }) {
  const locale = useLocale();
  const t = useTranslations("crmConversation.thread");
  const iso = message.created_at ?? "";
  const time = messageTime(iso, locale);
  if (!time) return <EmptyValue />;

  const read = outgoing ? readAtLabel(iso, message.read_at, locale) : null;
  const readText = read ? (read.kind === "same-day" ? t("readAt", { time: read.text }) : t("readOn", { when: read.text })) : null;
  const details = [fullDateTime(iso, locale), readText].filter(Boolean).join(" · ");

  return (
    <TooltipWrapper content={details}>
      <time dateTime={iso} className="cursor-default">
        {time}
      </time>
    </TooltipWrapper>
  );
}

const MESSAGE_COLLAPSE_LIMIT = 500;

export function CollapsibleMessageText({ text }: { text: string }) {
  const t = useTranslations("crmConversation.thread");
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldCollapse = text.length > MESSAGE_COLLAPSE_LIMIT;

  if (!shouldCollapse) {
    return (
      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
        <FormattedMessageText>{text}</FormattedMessageText>
      </p>
    );
  }

  const displayedText = isExpanded ? text : text.slice(0, MESSAGE_COLLAPSE_LIMIT).trimEnd() + "...";

  return (
    <div className="text-sm leading-relaxed">
      <p className="whitespace-pre-wrap break-words">
        <FormattedMessageText>{displayedText}</FormattedMessageText>
      </p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="mt-1 text-xs font-medium text-primary-ink hover:text-primary-ink hover:underline transition-colors"
      >
        {isExpanded ? t("readLess") : t("readMore")}
      </button>
    </div>
  );
}

function FailedReceipt({ metadata }: { metadata?: unknown }) {
  const t = useTranslations("crmConversation");
  const failure = deliveryErrorFrom(metadata);
  const key = deliveryErrorKey(failure?.code);

  const reason = key ? t(`deliveryError.${key}`) : failure?.message || t("deliveryError.unknown");

  const tooltip = failure?.code
    ? `${t("deliveryError.title")}: ${reason} (${t("deliveryError.code", { code: failure.code })})`
    : `${t("deliveryError.title")}: ${reason}`;

  return (
    <TooltipWrapper content={tooltip}>
      <span
        tabIndex={0}
        role="img"
        aria-label={reason}
        className="inline-flex cursor-help rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        <WarningIcon weight="fill" className="h-3.5 w-3.5 flex-shrink-0 text-destructive-ink" />
      </span>
    </TooltipWrapper>
  );
}

export function ReadReceipt({
  read,
  deliveryStatus,
  metadata,
}: {
  read: boolean;
  deliveryStatus?: string;
  metadata?: unknown;
}) {
  if (deliveryStatus === "failed") return <FailedReceipt metadata={metadata} />;
  if (deliveryStatus === "read") return <Checks weight="bold" className="h-3.5 w-3.5 flex-shrink-0 text-info-ink" />;
  if (deliveryStatus === "delivered") {
    return <Checks weight="bold" className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />;
  }
  if (deliveryStatus) return <Check weight="bold" className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />;

  return <Checks weight="bold" className={cn("h-3.5 w-3.5 flex-shrink-0", read ? "text-info-ink" : "text-muted-foreground")} />;
}

const TYPING_DOT_DELAYS_MS = [0, 160, 320];

function useTypingLabel(names: readonly string[]): string {
  const t = useTranslations("crmConversation.thread");
  const tPresence = useTranslations("crmMessage.presence");
  const locale = useLocale();
  if (names.length === 0) return t("typing");
  if (names.length === 1) return tPresence("typing", { name: names[0] });
  const list = new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(names);
  return tPresence("typingMany", { names: list });
}

export function TypingIndicator({ names = [] }: { names?: readonly string[] }) {
  const label = useTypingLabel(names);
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <div className="flex gap-0.5" aria-hidden="true">
        {TYPING_DOT_DELAYS_MS.map((delay) => (
          <span
            key={delay}
            className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-dot-pulse motion-reduce:animate-none"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground ml-1">{label}</span>
    </div>
  );
}
