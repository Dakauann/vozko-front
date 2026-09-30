"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Phone, WhatsappLogo } from "@/components/icons";
import type { CallChannel } from "@/lib/call-session/channel";
import { formatPhoneForDisplay } from "@/lib/phone/display";
import { cn } from "@/lib/utils";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

export const CALL_ACTION =
  `inline-flex h-11 w-full items-center justify-center gap-2 rounded-[--radius] text-sm font-semibold transition-colors duration-DEFAULT disabled:pointer-events-none disabled:opacity-40 ${FOCUS_RING}`;

export function CallerIdentity({
  number,
  channel,
  via,
  ringing = false,
  numberId,
}: {
  number: string | null;
  channel: CallChannel | null;
  via?: string | null;
  ringing?: boolean;
  numberId?: string;
}) {
  const t = useTranslations("calling.incoming");
  const source = [channel ? t(`channel.${channel}`) : null, via].filter(Boolean).join(" · ");
  const ChannelIcon = channel === "whatsapp" ? WhatsappLogo : Phone;

  return (
    <div className="flex items-center gap-3">
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
        {ringing ? (
          <span aria-hidden className="absolute inset-0 rounded-full border-2 border-primary motion-safe:animate-ping" />
        ) : null}
        <ChannelIcon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p id={numberId} className="readout truncate text-lg font-semibold leading-tight text-foreground">
          {number ? formatPhoneForDisplay(number) : t("unknownNumber")}
        </p>
        {source ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{source}</p> : null}
      </div>
    </div>
  );
}

export function CallStatusLine({ tone, label, trailing }: { tone: "live" | "pending" | "ended"; label: string; trailing?: ReactNode }) {
  return (
    <div className="flex h-9 items-center justify-between gap-3 rounded-[--radius] bg-muted px-3">
      <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-foreground">
        <span
          aria-hidden
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            tone === "live" && "bg-healthy motion-safe:animate-dot-pulse",
            tone === "pending" && "bg-primary motion-safe:animate-dot-pulse",
            tone === "ended" && "bg-muted-foreground",
          )}
        />
        <span className="truncate">{label}</span>
      </span>
      {trailing ? <span className="readout shrink-0 text-sm tabular-nums text-foreground">{trailing}</span> : null}
    </div>
  );
}

export function CallControl({
  icon,
  label,
  onClick,
  pressed,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      disabled={disabled}
      className={cn("group flex flex-col items-center gap-1.5 rounded-[--radius] py-1 disabled:pointer-events-none disabled:opacity-40", FOCUS_RING)}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full border transition-colors duration-DEFAULT [&>svg]:h-5 [&>svg]:w-5",
          pressed
            ? "border-foreground bg-foreground text-background"
            : "border-control-edge bg-card text-foreground group-hover:bg-muted",
        )}
      >
        {icon}
      </span>
      <span className="text-2xs font-semibold text-muted-foreground group-hover:text-foreground">{label}</span>
    </button>
  );
}

export function CallContextNote({ title, detail, notes }: { title: string; detail?: string | null; notes?: string | null }) {
  return (
    <div className="rounded-[--radius] border-l-2 border-primary bg-muted px-3 py-2 text-left">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      {detail ? <p className="text-2xs text-muted-foreground">{detail}</p> : null}
      {notes ? <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs text-foreground">{notes}</p> : null}
    </div>
  );
}
