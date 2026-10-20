"use client";

import { useMemo } from "react";
import { useFormatter, useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ArrowSquareOut, PaperPlaneTilt, XCircle } from "@/components/icons";
import { PagedListFooter } from "@/components/leads/detail/PagedListFooter";
import { useFormSends, useOwnedPhones } from "@/hooks/use-whatsapp-forms";
import { sectionErrorCode } from "@/lib/analytics/section-query";
import { conversationHref, isEntryType } from "@/lib/conversations/deep-link";
import { formatPhoneForDisplay } from "@/lib/phone/display";
import { sendTone } from "@/lib/whatsapp-forms/status";
import type { FormDetail, Send } from "@/lib/whatsapp-forms/types";

import { useFormError } from "../use-form-text";

const PAGE_SIZES = [50] as const;

export function sendConversationHref(send: Pick<Send, "entryId" | "entryType">): string | null {
  return send.entryId && send.entryType && isEntryType(send.entryType) ? conversationHref(send.entryId, send.entryType) : null;
}

export function SendsTab({ detail }: { detail: FormDetail }) {
  const t = useTranslations("whatsappForms");
  const format = useFormatter();
  const errorText = useFormError();
  const query = useFormSends(detail.form.id);
  const phones = useOwnedPhones();
  const rows = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const phoneLabel = useMemo(() => {
    const map = new Map((phones.data ?? []).map((phone) => [phone.id, formatPhoneForDisplay(phone.displayPhoneNumber)]));
    return (id: string) => map.get(id);
  }, [phones.data]);

  const columns = useMemo<DashboardTableColumn<Send>[]>(
    () => [
      {
        key: "createdAt",
        header: t("sends.table.createdAt"),
        render: (row) => <span className="whitespace-nowrap text-sm text-foreground">{format.dateTime(new Date(row.sentAt ?? row.createdAt), { dateStyle: "short", timeStyle: "short" })}</span>,
      },
      { key: "contact", header: t("sends.table.contact"), render: (row) => <span className="whitespace-nowrap text-sm text-foreground">{formatPhoneForDisplay(row.contactNumber)}</span> },
      { key: "number", header: t("sends.table.number"), render: (row) => <span className="whitespace-nowrap text-sm text-muted-foreground">{phoneLabel(row.businessPhoneId) ?? <EmptyValue />}</span> },
      { key: "origin", header: t("sends.table.origin"), render: (row) => <span className="text-sm text-foreground">{t(`origin.${row.origin}`)}</span> },
      { key: "status", header: t("sends.table.status"), render: (row) => <StatusChip tone={sendTone(row.status)} label={t(`sendStatus.${row.status}`)} /> },
      { key: "reason", header: t("sends.table.reason"), render: (row) => (row.failureReason ? <span className="line-clamp-2 text-sm text-foreground">{row.failureReason}</span> : <EmptyValue />) },
      {
        key: "conversation",
        header: t("sends.table.conversation"),
        render: (row) => {
          const href = sendConversationHref(row);
          return href ? (
            <Button variant="ghost" size="sm" title={t("sends.open")} icon={<ArrowSquareOut className="h-3.5 w-3.5" />} iconVisible iconSide="left" link={href} newTab={false} />
          ) : (
            <EmptyValue />
          );
        },
      },
    ],
    [t, format, phoneLabel],
  );

  const failure = query.isError && !query.data ? query.error : null;

  return (
    <DashboardTable<Send>
      data={rows}
      columns={columns}
      rowKey={(row) => row.id}
      loading={query.isFetching && !query.data}
      emptyState={
        failure
          ? {
              icon: <XCircle className="h-7 w-7 text-destructive-ink" weight="fill" />,
              title: t("common.errorTitle"),
              description: errorText({ code: sectionErrorCode(failure) }),
              action: <Button variant="secondary" title={t("common.retry")} onClick={() => void query.refetch()} />,
            }
          : { icon: <PaperPlaneTilt className="h-7 w-7 text-muted-foreground" />, title: t("sends.empty.title"), description: t("sends.empty.description") }
      }
      footer={
        <PagedListFooter
          query={{
            hasNextPage: query.hasNextPage,
            isFetching: query.isFetching,
            isFetchingNextPage: query.isFetchingNextPage,
            isFetchNextPageError: query.isFetchNextPageError,
            isRefetchError: query.isRefetchError,
            error: query.error,
            fetchNextPage: query.fetchNextPage,
            refetch: query.refetch,
          }}
          pageSizes={PAGE_SIZES}
          loadMore={t("responses.loadMore")}
          loadingMore={t("responses.loadingMore")}
        />
      }
    />
  );
}
