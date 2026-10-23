"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { useEmailError } from "@/components/email-marketing/use-email-error";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { EnvelopeSimple, MagnifyingGlass, Tag, XCircle } from "@/components/icons";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useEmailLog } from "@/hooks/use-email-api";
import { emailLogEntryPath, logStatusTone } from "@/lib/email-api/presentation";
import { EMAIL_LOG_STATUSES, type EmailLogEntry, type EmailLogFilters, type EmailLogStatus } from "@/lib/email-api/types";

const FILTER_DEBOUNCE_MS = 350;
const ALL = "all";

export function EmailLogTable() {
  const t = useTranslations("emailApi.log");
  const tm = useTranslations("emailMarketing");
  const format = useFormatter();
  const describe = useEmailError();
  const router = useRouter();
  const [status, setStatus] = useState<EmailLogStatus | "">("");
  const [recipient, setRecipient] = useState("");
  const [tagName, setTagName] = useState("");
  const [tagValue, setTagValue] = useState("");
  const filters: EmailLogFilters = { status, recipient: useDebouncedValue(recipient, FILTER_DEBOUNCE_MS), tagName: useDebouncedValue(tagName, FILTER_DEBOUNCE_MS), tagValue: useDebouncedValue(tagValue, FILTER_DEBOUNCE_MS) };
  const log = useEmailLog(filters);
  const rows = log.data?.pages.flatMap((page) => page.data) ?? [];
  const filtering = status !== "" || filters.recipient.trim() !== "" || (filters.tagName.trim() !== "" && filters.tagValue.trim() !== "");

  const columns: DashboardTableColumn<EmailLogEntry>[] = [
    {
      header: t("columns.recipient"),
      key: "recipient",
      render: (row) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono text-xs text-foreground">{row.to}</span>
          {row.role !== "to" ? <StatusChip tone="outline" label={t(`roles.${row.role}`)} /> : null}
        </span>
      ),
    },
    { header: t("columns.subject"), key: "subject", render: (row) => <span className="line-clamp-1 text-sm text-foreground">{row.subject}</span> },
    {
      header: t("columns.status"),
      key: "status",
      render: (row) => (
        <span className="flex flex-col gap-0.5">
          <StatusChip tone={logStatusTone(row.status)} label={t(`statuses.${row.status}`)} />
          {row.error_code ? <span className="text-xs text-muted-foreground">{describe({ code: row.error_code })}</span> : null}
        </span>
      ),
    },
    {
      header: t("columns.tags"),
      key: "tags",
      render: (row) => (
        <span className="flex flex-wrap gap-1">
          {Object.entries(row.tags).map(([name, value]) => (
            <StatusChip key={name} tone="outline" label={`${name}: ${value}`} />
          ))}
        </span>
      ),
    },
    {
      header: t("columns.created"),
      key: "created",
      render: (row) => <span className="text-sm text-muted-foreground tabular-nums">{format.dateTime(new Date(row.created_at), { dateStyle: "short", timeStyle: "medium" })}</span>,
    },
  ];

  return (
    <DashboardTable<EmailLogEntry>
      headerLeft={
        <div className="flex w-full flex-wrap items-center gap-2">
          <div className="w-full max-w-xs">
            <ElevatedInput
              type="search"
              label={t("recipient")}
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
              controlSize="sm"
              className="w-full"
              autoComplete="off"
            />
          </div>
          <div className="w-44">
            <ElevatedSelect label={t("status")} value={status === "" ? ALL : status} onValueChange={(value) => setStatus(value === ALL ? "" : (value as EmailLogStatus))}>
              <ElevatedSelectItem value={ALL}>{t("allStatuses")}</ElevatedSelectItem>
              {EMAIL_LOG_STATUSES.map((s) => (
                <ElevatedSelectItem key={s} value={s}>
                  {t(`statuses.${s}`)}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
          </div>
          <div className="w-36">
            <ElevatedInput label={t("tagName")} value={tagName} onChange={(event) => setTagName(event.target.value)} icon={<Tag className="h-4 w-4" weight="bold" />} controlSize="sm" autoComplete="off" />
          </div>
          <div className="w-36">
            <ElevatedInput label={t("tagValue")} value={tagValue} onChange={(event) => setTagValue(event.target.value)} controlSize="sm" autoComplete="off" />
          </div>
        </div>
      }
      data={log.isError ? [] : rows}
      columns={columns}
      rowKey={(row) => row.id}
      loading={log.isPending}
      onRowClick={(row) => router.push(emailLogEntryPath(row.id))}
      emptyState={
        log.isError
          ? {
              icon: <XCircle className="h-7 w-7 text-destructive-ink" weight="bold" />,
              title: t("loadFailed"),
              description: describe(log.error),
              action: <Button variant="outline" size="sm" title={tm("common.retry")} onClick={() => void log.refetch()} />,
            }
          : filtering
            ? { icon: <MagnifyingGlass className="h-7 w-7 text-muted-foreground" />, title: t("noMatchesTitle"), description: t("noMatchesText") }
            : { icon: <EnvelopeSimple className="h-7 w-7 text-muted-foreground" weight="bold" />, title: t("emptyTitle"), description: t("emptyText") }
      }
      footer={
        log.hasNextPage ? (
          <div className="flex justify-center py-2">
            <Button variant="outline" size="sm" title={log.isFetchingNextPage ? t("loadingMore") : t("loadMore")} disabled={log.isFetchingNextPage} onClick={() => void log.fetchNextPage()} />
          </div>
        ) : undefined
      }
    />
  );
}
