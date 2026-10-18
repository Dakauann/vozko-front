"use client";

import { useTranslations } from "next-intl";

import { Chip, SENTIMENT_COLOR } from "@/components/audience/shared";
import type { AlertLevel, NumberSeat, RunSentiment, WorkspaceGroup } from "@/lib/unofficial-whatsapp-groups/types";
import { cn } from "@/lib/utils";

export const RUN_SENTIMENT_COLOR: Record<RunSentiment, string> = {
  ...SENTIMENT_COLOR,
  mixed: "hsl(var(--warning))",
};

export const ALERT_COLOR: Record<AlertLevel, string> = {
  low: "hsl(var(--muted-foreground))",
  medium: "hsl(var(--warning))",
  high: "hsl(var(--destructive))",
};

export function RunSentimentChip({ sentiment }: { sentiment: RunSentiment }) {
  const t = useTranslations("unofficialGroups.common.sentiment");
  return <Chip dot={RUN_SENTIMENT_COLOR[sentiment]}>{t(sentiment)}</Chip>;
}

export function AlertChip({ level }: { level: AlertLevel }) {
  const t = useTranslations("unofficialGroups.common.alert");
  return <Chip dot={ALERT_COLOR[level]}>{t(level)}</Chip>;
}

export function GroupAvatar({ group, size = "md" }: { group: Pick<WorkspaceGroup, "subject" | "pictureUrl">; size?: "sm" | "md" | "lg" }) {
  const box = size === "sm" ? "h-7 w-7 text-2xs" : size === "lg" ? "h-12 w-12 text-sm" : "h-9 w-9 text-xs";
  const initials = group.subject
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  if (group.pictureUrl) {
    return <img src={group.pictureUrl} alt="" className={cn("shrink-0 rounded-full border border-border object-cover", box)} />;
  }
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-muted font-semibold text-muted-foreground", box)}>
      {initials || "#"}
    </span>
  );
}

export function NumberSeats({ seats, limit = 3 }: { seats: NumberSeat[]; limit?: number }) {
  const t = useTranslations("unofficialGroups.common.seat");
  const shown = seats.slice(0, limit);
  const hidden = seats.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((seat) => (
        <Chip
          key={seat.instanceId}
          dot={seat.connected ? "hsl(var(--healthy))" : "hsl(var(--muted-foreground))"}
          title={[seat.phone ? `+${seat.phone}` : null, seat.connected ? null : t("offline"), seat.admin ? t("admin") : null, seat.canPost ? null : t("readOnly")]
            .filter(Boolean)
            .join(" · ")}
          className={seat.canPost ? undefined : "text-muted-foreground"}
        >
          {seat.label}
          {seat.admin ? <span className="text-muted-foreground">{t("adminShort")}</span> : null}
        </Chip>
      ))}
      {hidden > 0 ? <span className="text-2xs text-muted-foreground">{t("more", { count: hidden })}</span> : null}
    </div>
  );
}
