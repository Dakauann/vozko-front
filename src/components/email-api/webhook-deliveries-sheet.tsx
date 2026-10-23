"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { isActionError } from "@/app/actions/action-result";
import { retryEmailWebhookDeliveryAction } from "@/app/actions/email-api";
import { useEmailError } from "@/components/email-marketing/use-email-error";
import Button from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { ElevatedSheet, ElevatedSheetContent, ElevatedSheetDescription, ElevatedSheetHeader, ElevatedSheetTitle } from "@/components/elevated-design/elevated-sheet";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { ArrowCounterClockwise } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import { useEmailWebhookDeliveries } from "@/hooks/use-email-api";
import { deliveryStatusTone } from "@/lib/email-api/presentation";
import type { EmailWebhookDelivery, EmailWebhookEndpoint } from "@/lib/email-api/types";

export function WebhookDeliveriesSheet({ endpoint, canConfigure, onClose }: { endpoint: EmailWebhookEndpoint; canConfigure: boolean; onClose: () => void }) {
  const t = useTranslations("emailApi.deliveries");
  const tw = useTranslations("emailApi.webhooks");
  const format = useFormatter();
  const describe = useEmailError();
  const deliveries = useEmailWebhookDeliveries(endpoint.id, true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const rows = deliveries.data?.pages.flatMap((page) => page.data) ?? [];
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "short", timeStyle: "medium" });

  const retry = async (delivery: EmailWebhookDelivery) => {
    setRetrying(delivery.id);
    const result = await retryEmailWebhookDeliveryAction(endpoint.id, delivery.id);
    setRetrying(null);
    if (isActionError(result)) {
      toast.error(describe(result));
      return;
    }
    toast.success(t("retried"));
    void deliveries.refetch();
  };

  return (
    <ElevatedSheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <ElevatedSheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <ElevatedSheetHeader>
          <ElevatedSheetTitle className="text-xl">{t("title")}</ElevatedSheetTitle>
          <ElevatedSheetDescription className="break-all font-mono text-xs">{endpoint.url}</ElevatedSheetDescription>
        </ElevatedSheetHeader>
        <div className="space-y-3 px-6 pb-6">
          {deliveries.isError ? (
            <Notice tone="fault" title={t("loadFailed")}>
              <p>{describe(deliveries.error)}</p>
            </Notice>
          ) : null}
          {deliveries.isPending ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}
          {!deliveries.isPending && rows.length === 0 && !deliveries.isError ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}
          <ul className="space-y-3">
            {rows.map((delivery) => (
              <li key={delivery.id} className="space-y-2 rounded-[--radius] border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusChip tone={deliveryStatusTone(delivery.status)} label={t(`statuses.${delivery.status}`)} />
                    <span className="text-sm text-foreground">{tw.has(`eventNames.${delivery.event_type}`) ? tw(`eventNames.${delivery.event_type}`) : delivery.event_type}</span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{date(delivery.created_at)}</span>
                </div>
                <p className="font-mono text-2xs text-muted-foreground">{delivery.event_id}</p>
                {delivery.next_attempt_at && delivery.status === "retrying" ? (
                  <p className="text-xs text-muted-foreground">{t("nextAttempt", { at: date(delivery.next_attempt_at) })}</p>
                ) : null}
                {delivery.attempt_log.length > 0 ? (
                  <table className="w-full text-left text-xs">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="py-1 font-medium">{t("attempt")}</th>
                        <th className="py-1 font-medium">{t("statusCode")}</th>
                        <th className="py-1 font-medium">{t("duration")}</th>
                        <th className="py-1 font-medium">{t("error")}</th>
                        <th className="py-1 font-medium">{t("when")}</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums text-foreground">
                      {delivery.attempt_log.map((a) => (
                        <tr key={a.attempt} className="border-t border-border">
                          <td className="py-1">{a.attempt}</td>
                          <td className="py-1">{a.status_code > 0 ? a.status_code : <EmptyValue />}</td>
                          <td className="py-1">{t("ms", { value: a.duration_ms })}</td>
                          <td className="max-w-[14rem] truncate py-1" title={a.error}>
                            {a.error ? a.error : <EmptyValue />}
                          </td>
                          <td className="py-1">{date(a.attempted_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                {canConfigure && delivery.retryable ? (
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<ArrowCounterClockwise className="h-3.5 w-3.5" weight="bold" />}
                    iconVisible
                    title={retrying === delivery.id ? t("retrying") : t("retry")}
                    disabled={retrying !== null}
                    onClick={() => void retry(delivery)}
                  />
                ) : null}
              </li>
            ))}
          </ul>
          {deliveries.hasNextPage ? (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" title={deliveries.isFetchingNextPage ? t("loadingMore") : t("loadMore")} disabled={deliveries.isFetchingNextPage} onClick={() => void deliveries.fetchNextPage()} />
            </div>
          ) : null}
        </div>
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
