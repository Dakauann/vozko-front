"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { listOpportunityEventsAction } from "@/app/actions/opportunities";
import {
  dealActorName,
  dealEventMessage,
  type DealActorLabels,
  type OpportunityEvent,
} from "@/lib/crm/opportunities";

interface OpportunityHistoryProps {
  opportunityId: string;
  updatedAt: string;
  members: ReadonlyMap<string, string>;
  stageNames: ReadonlyMap<string, string>;
  actorLabels: DealActorLabels;
}

export default function OpportunityHistory({
  opportunityId,
  updatedAt,
  members,
  stageNames,
  actorLabels,
}: OpportunityHistoryProps) {
  const t = useTranslations("opportunityHistory");
  const format = useFormatter();
  const [events, setEvents] = useState<OpportunityEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void listOpportunityEventsAction(opportunityId).then((res) => {
      if (!live) return;
      setEvents(res.events);
      setError(res.error ?? null);
    });
    return () => {
      live = false;
    };
  }, [opportunityId, updatedAt]);

  const labels = {
    removedStage: t("removedStage"),
    money: (cents: number, currency: string) => format.number(cents / 100, { style: "currency", currency }),
  };

  const textOf = (event: OpportunityEvent) => {
    const actor = dealActorName(event.actorId, members, actorLabels, event.actorName) ?? actorLabels.system;
    const { key, values } = dealEventMessage(event, actor, stageNames, labels);
    return t.has(`events.${key}`) ? t(`events.${key}`, values) : t("events.other", values);
  };

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <p className="text-2xs font-semibold text-muted-foreground">{t("title")}</p>
      {error ? (
        <p className="text-xs text-destructive-ink">{t("loadFailed")}</p>
      ) : events === null ? (
        <p className="text-xs text-muted-foreground">{t("loading")}</p>
      ) : events.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ol className="space-y-1.5">
          {[...events].reverse().map((event) => (
            <li key={event.id} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-foreground">{textOf(event)}</span>
              <time className="flex-shrink-0 tabular-nums text-muted-foreground" dateTime={event.createdAt}>
                {format.dateTime(new Date(event.createdAt), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </time>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
