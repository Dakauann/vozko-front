"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Chip } from "@/components/audience/shared";
import { StatusChip } from "@/components/elevated-design/status-chip";
import type { NumberSeat } from "@/lib/unofficial-whatsapp-groups/types";
import { cn } from "@/lib/utils";

import { displayPhone } from "../kit/format";

function useSeatLabels() {
  const tSeat = useTranslations("unofficialGroups.common.seat");
  const tNumbers = useTranslations("unofficialGroups.detail.settings.numbers");
  const tTab = useTranslations("unofficialGroups.detail.settingsTab.numbers");
  return {
    connected: tNumbers("connected"),
    offline: tSeat("offline"),
    admin: tSeat("adminShort"),
    posts: tTab("posts"),
    readOnly: tNumbers("readOnly"),
  };
}

function SeatRow({ seat, layout = "line", trailing }: { seat: NumberSeat; layout?: "line" | "card"; trailing?: ReactNode }) {
  const labels = useSeatLabels();
  const phone = displayPhone(seat.phone);
  const connection = seat.connected ? labels.connected : labels.offline;
  const admin = seat.admin ? <Chip>{labels.admin}</Chip> : null;
  const posting = seat.canPost ? labels.posts : labels.readOnly;

  if (layout === "line") {
    return (
      <li className="flex items-center gap-2 py-1.5 text-xs">
        <span
          role="img"
          aria-label={connection}
          title={connection}
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", seat.connected ? "bg-healthy" : "bg-muted-foreground")}
        />
        <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{seat.label}</span>
        {phone ? <span className="readout hidden font-mono text-2xs text-muted-foreground sm:inline">{phone}</span> : null}
        {admin}
        <span className="shrink-0 text-2xs text-muted-foreground">{posting}</span>
        {trailing}
      </li>
    );
  }

  return (
    <li className="space-y-1.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">{seat.label}</p>
          {phone ? <p className="readout truncate font-mono text-2xs text-muted-foreground">{phone}</p> : null}
        </div>
        {trailing}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusChip tone={seat.connected ? "healthy" : "muted"} label={connection} />
        {admin}
        <Chip className={seat.canPost ? undefined : "text-muted-foreground"}>{posting}</Chip>
      </div>
    </li>
  );
}

export function SeatList({
  seats,
  layout = "line",
  trailing,
}: {
  seats: NumberSeat[];
  layout?: "line" | "card";
  trailing?: (seat: NumberSeat) => ReactNode;
}) {
  return (
    <ul className="divide-y divide-border">
      {seats.map((seat) => (
        <SeatRow key={seat.instanceId} seat={seat} layout={layout} trailing={trailing?.(seat)} />
      ))}
    </ul>
  );
}
