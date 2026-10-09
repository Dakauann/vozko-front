"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { ArrowClockwise, PhoneOutgoing, XCircle } from "@/components/icons";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { useAccess } from "@/hooks/use-access";
import { useCallListsPage } from "@/hooks/use-call-lists";
import { useRouter } from "@/i18n/routing";
import { sectionErrorCode } from "@/lib/analytics/section-query";
import { CALL_LIST_STATUSES, type CallList, type CallListStatus } from "@/lib/call-lists/types";
import { pathForScreen } from "@/lib/navigation/routes";
import { cn } from "@/lib/utils";

import { CallListActionsMenu } from "./CallListActionsMenu";
import { useMemberNames } from "./CallListAssigneePicker";
import { CallListProgressCell, CallListStatusChip, useCallListError, useCallListPhoneLabel } from "./CallListBits";

const PAGE_SIZES = [20, 50, 100] as const;
const ANY = "any";
const SHOWN_ASSIGNEES = 2;

export function CallListsPage() {
  const t = useTranslations("callLists");
  const format = useFormatter();
  const router = useRouter();
  const { decideCapabilities } = useAccess();
  const manages = decideCapabilities(["call_lists.manage"]) === "granted";
  const members = useMemberNames();
  const phoneLabel = useCallListPhoneLabel();
  const errorText = useCallListError();

  const [status, setStatus] = useState<CallListStatus | typeof ANY>(ANY);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const query = useCallListsPage({ page, pageSize, status: status === ANY ? undefined : status });
  const current = query.data;
  const lists = current?.items ?? [];
  const loading = query.isFetching && !current;
  const totalPages = current ? Math.max(1, Math.ceil(current.total / current.pageSize)) : 1;

  const open = (list: CallList) => {
    const path = pathForScreen("call_list_detail", { listId: list.id });
    if (path) router.push(path);
  };

  const columns = useMemo<DashboardTableColumn<CallList>[]>(
    () => [
      {
        key: "name",
        header: t("table.name"),
        render: (list) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">{list.name}</span>
            <span className="truncate text-xs text-muted-foreground">{phoneLabel(list)}</span>
          </div>
        ),
      },
      {
        key: "assignees",
        header: t("table.assignees"),
        render: (list) => {
          const names = list.assigneeIds.slice(0, SHOWN_ASSIGNEES).map(members.name);
          const rest = list.assigneeIds.length - names.length;
          return (
            <span className="text-sm text-foreground">
              {names.join(", ")}
              {rest > 0 ? <span className="text-muted-foreground">{` +${rest}`}</span> : null}
            </span>
          );
        },
      },
      {
        key: "progress",
        header: t("table.progress"),
        render: (list) => <CallListProgressCell list={list} />,
      },
      {
        key: "status",
        header: t("table.status"),
        render: (list) => <CallListStatusChip status={list.status} />,
      },
      {
        key: "createdAt",
        header: t("table.createdAt"),
        render: (list) => (
          <span className="whitespace-nowrap text-sm text-muted-foreground">{format.dateTime(new Date(list.createdAt), { dateStyle: "short" })}</span>
        ),
      },
    ],
    [t, format, members, phoneLabel],
  );

  const failure = query.isError && !current ? query.error : null;

  return (
    <div className="w-full space-y-6">
      <DashboardPageHeader badge={t("page.title")} description={t("page.description")} icon={<PhoneOutgoing className="h-6 w-6" />} />

      <DashboardTable<CallList>
        data={lists}
        columns={columns}
        rowKey={(list) => list.id}
        loading={loading}
        onRowClick={open}
        renderRowActions={manages ? (list) => <CallListActionsMenu list={list} /> : undefined}
        toolbar={
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
            <ElevatedSelect
              label={t("filters.status")}
              aria-label={t("filters.status")}
              value={status}
              onValueChange={(value) => {
                setStatus(value as CallListStatus | typeof ANY);
                setPage(1);
              }}
            >
              <ElevatedSelectItem value={ANY}>{t("filters.any")}</ElevatedSelectItem>
              {CALL_LIST_STATUSES.map((option) => (
                <ElevatedSelectItem key={option} value={option}>
                  {t(`status.${option}`)}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
          </div>
        }
        stats={[{ label: t("stats.lists"), value: current ? current.total : "…", icon: <PhoneOutgoing className="h-4 w-4 text-info-ink" /> }]}
        headerRight={
          <Button
            variant="ghost"
            title=""
            aria-label={t("page.refresh")}
            icon={<ArrowClockwise weight="bold" className={cn("h-4 w-4", query.isFetching && "animate-spin")} />}
            iconVisible
            iconSide="left"
            onClick={() => void query.refetch()}
          />
        }
        pagination={
          current && current.total > 0
            ? {
                currentPage: current.page,
                totalPages,
                pageSize: current.pageSize,
                totalItems: current.total,
                onPageChange: setPage,
                pageSizeOptions: PAGE_SIZES,
                onPageSizeChange: (size) => {
                  setPageSize(size);
                  setPage(1);
                },
              }
            : undefined
        }
        emptyState={
          failure
            ? {
                icon: <XCircle className="h-7 w-7 text-destructive-ink" weight="fill" />,
                title: t("page.errorTitle"),
                description: errorText({ code: sectionErrorCode(failure) }),
                action: <Button variant="secondary" title={t("page.retry")} onClick={() => void query.refetch()} />,
              }
            : {
                icon: <PhoneOutgoing className="h-7 w-7 text-muted-foreground" />,
                title: t("page.emptyTitle"),
                description: status === ANY ? t("page.emptyDescription") : t("page.emptyFiltered"),
                action:
                  status === ANY ? (
                    <Button variant="secondary" title={t("page.goToLeads")} onClick={() => router.push(pathForScreen("leads") ?? "/dashboard/leads")} />
                  ) : undefined,
              }
        }
      />
    </div>
  );
}
