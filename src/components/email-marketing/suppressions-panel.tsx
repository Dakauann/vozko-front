"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { isActionError } from "@/app/actions/action-result";
import { addEmailSuppressionAction, removeEmailSuppressionAction } from "@/app/actions/email-marketing";
import { useEmailError } from "@/components/email-marketing/use-email-error";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { StatusChip, type StatusChipTone } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { MagnifyingGlass, Prohibit, Trash } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useEmailSuppressions } from "@/hooks/use-email-marketing";
import type { EmailSuppression, EmailSuppressionReason } from "@/lib/email-marketing/types";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const REASON_TONE: Record<EmailSuppressionReason, StatusChipTone> = {
  complaint: "fault",
  hard_bounce: "warning",
  manual: "muted",
  soft_bounce: "warning",
};

export function SuppressionsPanelBody({ canConfigure }: { canConfigure: boolean }) {
  const t = useTranslations("emailMarketing.suppressions");
  const tm = useTranslations("emailMarketing");
  const format = useFormatter();
  const describe = useEmailError();
  const [page, setPage] = useState(1);
  const [address, setAddress] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<EmailSuppression | null>(null);
  const [search, setSearch] = useState("");
  const [settledSearch, setSettledSearch] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSettledSearch(search), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);
  const query = useEmailSuppressions(page, PAGE_SIZE, settledSearch, true);
  const searching = settledSearch.trim() !== "";
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;

  const add = async () => {
    setAdding(true);
    setAddError(null);
    const result = await addEmailSuppressionAction(address.trim());
    setAdding(false);
    if (isActionError(result)) {
      setAddError(describe(result));
      return;
    }
    toast.success(t("added", { address: result.data.address }));
    setAddress("");
    void query.refetch();
  };

  const remove = async () => {
    if (!removing) return true;
    const result = await removeEmailSuppressionAction(removing.address);
    if (isActionError(result)) {
      toast.error(describe(result));
      return true;
    }
    toast.success(t("removed", { address: removing.address }));
    void query.refetch();
    return true;
  };

  const columns: DashboardTableColumn<EmailSuppression>[] = [
    { header: t("columns.address"), key: "address", render: (row) => <span className="font-mono text-xs text-foreground">{row.address}</span> },
    { header: t("columns.reason"), key: "reason", render: (row) => <StatusChip tone={REASON_TONE[row.reason] ?? "muted"} label={t(`reasons.${row.reason}`)} /> },
    {
      header: t("columns.since"),
      key: "since",
      render: (row) => <span className="text-sm text-muted-foreground">{format.dateTime(new Date(row.suppressed_at), { dateStyle: "short", timeStyle: "short" })}</span>,
    },
    ...(canConfigure
      ? [
          {
            header: t("columns.actions"),
            key: "actions",
            className: "text-right",
            render: (row: EmailSuppression) =>
              row.removable ? (
                <Button size="sm" variant="ghost" icon={<Trash className="h-3.5 w-3.5" weight="bold" />} iconVisible aria-label={t("remove", { address: row.address })} onClick={() => setRemoving(row)} />
              ) : (
                <span className="text-2xs text-muted-foreground">{t("locked")}</span>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      {canConfigure ? (
        <form
          className="flex flex-wrap items-start gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <div className="min-w-[16rem] flex-1">
            <ElevatedInput label={t("addLabel")} placeholder=" " type="email" value={address} onChange={(event) => setAddress(event.target.value)} error={addError ?? undefined} autoComplete="off" />
          </div>
          <Button type="submit" className="mt-1.5" icon={<Prohibit className="h-4 w-4" weight="bold" />} iconVisible title={adding ? t("adding") : t("add")} disabled={adding || address.trim() === ""} />
        </form>
      ) : null}

      <DashboardTable<EmailSuppression>
        headerLeft={
          <div className="w-full max-w-xs">
            <ElevatedInput
              type="search"
              label={t("search")}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
              controlSize="sm"
              className="w-full"
              autoComplete="off"
            />
          </div>
        }
        data={query.isError ? [] : rows}
        columns={columns}
        rowKey={(row) => row.address}
        loading={query.isPending}
        emptyState={
          query.isError
            ? { icon: <Prohibit className="h-7 w-7 text-destructive-ink" weight="bold" />, title: t("loadFailed"), description: describe(query.error) }
            : searching
              ? { icon: <MagnifyingGlass className="h-7 w-7 text-muted-foreground" />, title: t("noMatchesTitle"), description: t("noMatchesText") }
              : { icon: <Prohibit className="h-7 w-7 text-muted-foreground" weight="bold" />, title: t("emptyTitle"), description: t("emptyText") }
        }
        pagination={
          meta && meta.totalPages > 1
            ? { currentPage: meta.page, totalPages: meta.totalPages, pageSize: meta.pageSize, totalItems: meta.totalItems, onPageChange: setPage }
            : undefined
        }
      />

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => (open ? undefined : setRemoving(null))}
        title={t("removeTitle", { address: removing?.address ?? "" })}
        description={t("removeText")}
        confirmLabel={t("removeConfirm")}
        cancelLabel={tm("common.cancel")}
        onConfirm={remove}
      />
    </div>
  );
}
