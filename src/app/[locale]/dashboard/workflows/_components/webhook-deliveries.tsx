"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import { ArrowRight, ArrowsClockwise, CircleNotch } from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { listWorkflowWebhookDeliveriesAction } from "@/app/actions/workflows";
import { usePagedList } from "@/hooks/use-paged-list";
import { workflowRunHref } from "@/lib/workflows/run-format";
import type { WebhookDelivery } from "@/lib/workflows/types";
import { webhookOutcomeLabel, webhookReasonLabel, webhookResolutionLabel } from "@/lib/workflows/webhook-delivery";

import { ConversationLink, DateTimeText, LoadFailure, useOpenRun } from "./run-bits";

const PAGE_SIZE = 10;

export function WebhookDeliveries({ workflowId, focused = false }: { workflowId: string; focused?: boolean }) {
  const t = useTranslations("workflowRuns.webhook");
  const sectionRef = useRef<HTMLElement>(null);
  const openRun = useOpenRun();
  const readDeliveries = useCallback(
    async (page: number) => {
      const res = await listWorkflowWebhookDeliveriesAction(workflowId, { page, pageSize: PAGE_SIZE });
      return { items: res.deliveries, meta: res.meta, error: res.error, status: res.status };
    },
    [workflowId],
  );
  const list = usePagedList({ scope: workflowId, read: readDeliveries, accumulate: true });
  const { items: deliveries, loading, hasMore, refresh } = list;

  useEffect(() => {
    if (!focused) return;
    const frame = requestAnimationFrame(() => sectionRef.current?.scrollIntoView?.({ block: "start", behavior: "smooth" }));
    return () => cancelAnimationFrame(frame);
  }, [focused]);

  return (
    <section ref={sectionRef} aria-label={t("title")} className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-foreground">{t("title")}</span>
        {loading && <CircleNotch size={12} className="animate-spin text-muted-foreground" />}
        <div className="flex-1" />
        <ElevatedButton
          variant="ghost"
          size="icon"
          iconVisible
          icon={<ArrowsClockwise size={12} />}
          aria-label={t("refresh")}
          title=""
          onClick={refresh}
          className="h-6 w-6"
        />
      </div>

      {!loading && list.error && (
        <div className="p-3">
          <LoadFailure status={list.errorStatus} fallback={t("loadError")} />
        </div>
      )}
      {!loading && !list.error && deliveries.length === 0 && <p className="px-3 py-3 text-2xs text-muted-foreground">{t("empty")}</p>}

      {deliveries.length > 0 && (
        <ul className="max-h-80 divide-y divide-border overflow-y-auto">
          {deliveries.map((delivery) => (
            <DeliveryRow key={delivery.id} delivery={delivery} workflowId={workflowId} openRun={openRun} />
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="border-t border-border px-3 py-2">
          <ElevatedButton variant="ghost" size="sm" title={t("more")} disabled={loading} onClick={() => list.setPage(list.page + 1)} />
        </div>
      )}
    </section>
  );
}

function DeliveryRow({
  delivery,
  workflowId,
  openRun,
}: {
  delivery: WebhookDelivery;
  workflowId: string;
  openRun: ((runId: string) => void) | null;
}) {
  const t = useTranslations("workflowRuns.webhook");
  const tRuns = useTranslations("workflowRuns");
  const outcome = webhookOutcomeLabel(delivery.outcome, t);
  const reason = webhookReasonLabel(delivery.reason, t);
  const resolution = webhookResolutionLabel(delivery.entryResolution, t);

  return (
    <li className="space-y-1 px-3 py-2">
      <div className="flex items-center gap-2">
        <StatusChip tone={outcome.tone} label={outcome.label} className="px-2 text-2xs" />
        <span className="readout font-mono text-2xs font-semibold tabular-nums text-foreground">{delivery.httpStatus}</span>
        <span className="min-w-0 flex-1 truncate text-2xs text-foreground">{reason}</span>
        <DateTimeText value={delivery.receivedAt} className="shrink-0 text-2xs text-muted-foreground" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <ConversationLink entryId={delivery.entryId} entryType={delivery.entryType} />
          {resolution ? <span className="text-2xs text-muted-foreground">{resolution}</span> : null}
        </span>
        {delivery.runId && (
          <a
            href={workflowRunHref(workflowId, delivery.runId)}
            onClick={(event) => {
              if (!openRun || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
              event.preventDefault();
              openRun(delivery.runId!);
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-[--radius] text-2xs font-medium text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tRuns("openRun")}
            <ArrowRight size={10} weight="bold" />
          </a>
        )}
      </div>
    </li>
  );
}
