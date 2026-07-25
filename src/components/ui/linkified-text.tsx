"use client";

import * as React from "react";

import { ArrowSquareOut, Warning } from "@phosphor-icons/react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

import { useTranslations } from "next-intl";

// Single capturing group so String.split() yields URLs at odd indices.
export const URL_REGEX =
  /(https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+\.[^\s<>"')\]]+)/gi;

function sanitizeUrl(raw: string): string {
  const url = raw.startsWith("www.") ? `https://${raw}` : raw;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "#";
    }
    return parsed.href;
  } catch {
    return "#";
  }
}

function truncateUrl(raw: string, maxLen = 50): string {
  if (raw.length <= maxLen) return raw;
  return raw.slice(0, maxLen - 1) + "…";
}

/** A single detected URL rendered as a link with a safety hover-card. */
export function LinkPreview({ url }: { url: string }) {
  const t = useTranslations("common.linkWarning");
  const href = sanitizeUrl(url);

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary transition-colors break-all"
          onClick={(e) => {
            if (href === "#") e.preventDefault();
          }}
        >
          {truncateUrl(url)}
          <ArrowSquareOut
            className="inline h-3 w-3 shrink-0 opacity-60"
            weight="bold"
          />
        </a>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="center"
        sideOffset={6}
        className="w-72 rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl p-4 shadow-2xl shadow-slate-900/10"
      >
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg">
            <Warning
              className="h-4 w-4"
              weight="fill"
            />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold text-foreground">
              {t("title")}
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t("description")}
            </p>
            <p
              className="truncate text-[10px] font-mono text-muted-foreground/60"
              title={href !== "#" ? href : url}
            >
              {href !== "#" ? href : url}
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

interface LinkifiedTextProps {
  children: string;
  className?: string;
}

export default function LinkifiedText({
  children,
  className,
}: LinkifiedTextProps) {
  // split() with one capturing group => odd indices are the matched URLs.
  const parts = children.split(URL_REGEX);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <LinkPreview key={i} url={part} />
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </span>
  );
}
