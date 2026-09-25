"use client";

import { useEffect, useState } from "react";

import { listOpportunityEventsAction } from "@/app/actions/opportunities";
import {
  dealActorName,
  dealEventText,
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

const whenFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default function OpportunityHistory({
  opportunityId,
  updatedAt,
  members,
  stageNames,
  actorLabels,
}: OpportunityHistoryProps) {
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

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <p className="text-2xs font-semibold text-muted-foreground">Histórico</p>
      {error ? (
        <p className="text-xs text-destructive-ink">Não foi possível carregar o histórico.</p>
      ) : events === null ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : events.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
          Sem registros para este negócio.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {[...events].reverse().map((event) => (
            <li key={event.id} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-foreground">
                {dealEventText(
                  event,
                  dealActorName(event.actorId, members, actorLabels) ?? actorLabels.system,
                  stageNames,
                )}
              </span>
              <time className="flex-shrink-0 tabular-nums text-muted-foreground" dateTime={event.createdAt}>
                {whenFormat.format(new Date(event.createdAt))}
              </time>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
