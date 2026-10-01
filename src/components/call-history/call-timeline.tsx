"use client";

import { useFormatter, useTranslations } from "next-intl";

import {
  ArrowsLeftRight,
  CheckCircle,
  ClockCounterClockwise,
  PhoneCall,
  PhoneDisconnect,
  PhoneIncoming,
  PhoneOutgoing,
  Prohibit,
  Queue,
  SignOut,
  Waveform,
  XCircle,
  type Icon,
} from "@/components/icons";
import { timelineKind } from "@/lib/call-history/format";
import type { CallDirection, CallTimelineEntry, TimelineKind } from "@/lib/call-history/types";

const KIND_ICONS: Record<TimelineKind, Icon> = {
  started: PhoneOutgoing,
  answered: PhoneCall,
  transfer_requested: ArrowsLeftRight,
  transfer_connected: CheckCircle,
  transfer_returned: ClockCounterClockwise,
  transfer_unanswered: XCircle,
  transfer_cancelled: Prohibit,
  caller_left: SignOut,
  ended: PhoneDisconnect,
  recording_ready: Waveform,
};

export function CallTimeline({ entries, direction }: { entries: CallTimelineEntry[]; direction: CallDirection }) {
  const t = useTranslations("callHistory.timeline");
  const format = useFormatter();
  const known = entries.flatMap((entry) => {
    const kind = timelineKind(entry.kind);
    return kind ? [{ ...entry, kind }] : [];
  });

  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {known.map((entry, index) => {
        const EntryIcon = entry.kind === "started" && direction === "inbound" ? PhoneIncoming : entry.kind === "transfer_requested" && entry.queueId ? Queue : KIND_ICONS[entry.kind];
        return (
          <li key={`${entry.kind}-${entry.at}-${index}`} className="relative">
            <span className="absolute -left-[29px] top-0 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
              <EntryIcon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm text-foreground">{describe(t, entry, direction)}</p>
              <time dateTime={entry.at} className="readout text-xs tabular-nums text-muted-foreground">
                {format.dateTime(new Date(entry.at), { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </time>
            </div>
            {entry.notes ? (
              <blockquote className="mt-1.5 whitespace-pre-wrap rounded-[--radius] border-l-2 border-primary bg-muted px-3 py-1.5 text-xs text-foreground">
                {entry.notes}
              </blockquote>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

type Translate = ReturnType<typeof useTranslations<"callHistory.timeline">>;

function describe(t: Translate, entry: CallTimelineEntry & { kind: TimelineKind }, direction: CallDirection): string {
  const actor = entry.actor?.name || t("someone");
  const target = entry.target?.name || t("someone");
  const queue = entry.queueName || t("aQueue");
  switch (entry.kind) {
    case "started":
      return direction === "inbound" ? t("startedInbound") : t("startedOutbound", { actor });
    case "answered":
      return entry.actor ? t("answeredBy", { actor }) : t("answered");
    case "transfer_requested":
      if (!entry.actor) return t("enteredQueue", { queue });
      return entry.queueId ? t("sentToQueue", { actor, queue }) : t("transferredTo", { actor, target });
    case "transfer_connected":
      return entry.queueId ? t("queueConnected", { actor, queue }) : t("transferConnected", { actor });
    case "transfer_returned":
      return t("transferReturned", { target });
    case "transfer_unanswered":
      return entry.queueId ? t("queueUnanswered", { queue }) : t("transferUnanswered", { target });
    case "transfer_cancelled":
      return t("transferCancelled");
    case "caller_left":
      return t("callerLeft");
    case "ended":
      return entry.reason && t.has(`endReasons.${entry.reason}`) ? t("endedWith", { reason: t(`endReasons.${entry.reason}`) }) : t("ended");
    case "recording_ready":
      return t("recordingReady");
  }
}
