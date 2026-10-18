"use client";

import { useNow } from "next-intl";

import { EmptyValue } from "@/components/elevated-design/empty-value";

import { parseInstant } from "./format";
import { useGroupsFormat } from "./use-groups-format";

export function RelativeTime({
  at,
  mode = "relative",
  emptyLabel,
  timeZone,
  className,
}: {
  at?: string;
  mode?: "relative" | "lastEvent";
  emptyLabel?: string;
  timeZone?: string;
  className?: string;
}) {
  const fmt = useGroupsFormat(timeZone);
  const now = useNow({ updateInterval: 60_000 });
  const instant = parseInstant(at);
  if (!at || !instant) {
    return emptyLabel ? <span className={className ?? "text-muted-foreground"}>{emptyLabel}</span> : <EmptyValue className={className} />;
  }
  return (
    <time dateTime={instant.toISOString()} title={fmt.dateTime(at)} className={className ?? "readout whitespace-nowrap tabular-nums"}>
      {mode === "lastEvent" ? fmt.lastEvent(at, now) : fmt.relative(at, now)}
    </time>
  );
}
