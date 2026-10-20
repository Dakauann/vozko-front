"use client";

import { ArrowClockwise, Eye, MagnifyingGlass, Plus, Trash } from "@/components/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { listMercadoLivreAccountsAction } from "@/app/actions/mercadolivre";
import { ChannelListPagination, ChannelListStat } from "@/components/channels/channel-list-parts";
import { CapabilityChip } from "@/components/channels/channel-profile-parts";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { MercadoLivreLogoColor } from "@/components/icons/channel-logos";
import { Notice } from "@/components/ui/notice";
import { useWorkspace } from "@/contexts/workspace-context";
import { useMercadoLivreConnect } from "@/hooks/use-mercadolivre-connect";
import { accountNotices, accountStatusKey, accountStatusTone, reconnectable } from "@/lib/mercadolivre/account";
import { MERCADOLIVRE_ACCOUNTS_PATH, MERCADOLIVRE_CONNECT_PATH, mercadoLivreAccountPath } from "@/lib/mercadolivre/connect";
import { MERCADOLIVRE_CAPABILITIES, type MercadoLivreAccount, type MercadoLivreConnectResult } from "@/lib/mercadolivre/types";
import { cn } from "@/lib/utils";

import { MercadoLivreDisconnectDialog } from "./mercadolivre-disconnect-dialog";
import { useConnectRedirectResult } from "./use-connect-redirect-result";
import { useMercadoLivreError } from "./use-mercadolivre-error";
import { useCheckedDate, usePurgeDate } from "@/components/channels/use-purge-date";

const ITEMS_PER_PAGE = 15;

function StatusCell({ account }: { account: MercadoLivreAccount }) {
  const t = useTranslations("mercadolivre");
  const purgeDate = usePurgeDate();
  const purge = accountNotices(account).find((notice) => notice.kind === "purge");
  return (
    <div className="flex flex-col gap-1">
      <StatusChip tone={accountStatusTone(account.status)} label={t(accountStatusKey(account.status))} className="w-fit" />
      {purge && purge.kind === "purge" ? (
        <span className="text-xs text-muted-foreground">{t("list.purgeOn", { date: purgeDate(purge.purgeAfter) })}</span>
      ) : null}
    </div>
  );
}

export function MercadoLivreAccountsList() {
  const t = useTranslations("mercadolivre");
  const router = useRouter();
  const describeError = useMercadoLivreError();
  const checkedDate = useCheckedDate();
  const { can } = useWorkspace();
  const canCreate = can("mercadolivre_accounts", "create");
  const canDelete = can("mercadolivre_accounts", "delete");

  const [accounts, setAccounts] = useState<MercadoLivreAccount[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<MercadoLivreAccount | null>(null);

  const fetchAccounts = useCallback(
    (nextPage: number, term: string) =>
      listMercadoLivreAccountsAction(nextPage, ITEMS_PER_PAGE, term || undefined).then((result) => {
        if ("error" in result && result.error) {
          setError(describeError(result));
        } else {
          setError(null);
          setAccounts(result.accounts);
          setPage(result.meta.page);
          setTotalPages(result.meta.totalPages);
          setTotalItems(result.meta.totalItems);
        }
        setLoading(false);
      }),
    [describeError],
  );

  const load = useCallback(
    (nextPage: number, term: string) => {
      setLoading(true);
      return fetchAccounts(nextPage, term);
    },
    [fetchAccounts],
  );

  useEffect(() => {
    void fetchAccounts(1, "");
  }, [fetchAccounts]);

  const reportResult = useCallback(
    (result: MercadoLivreConnectResult) => {
      if (result.status === "cancelled") return;
      if (result.status === "error") {
        toast.error(t("connect.errorTitle"), { description: t(`connectError.${result.reason ?? "connect_failed"}`) });
        return;
      }
      toast(result.status === "reconnected" ? t("connect.reconnectedTitle") : t("connect.successTitle"), {
        description: result.nickname ? t("connect.resultBody", { name: result.nickname }) : t("connect.resultBodyUnnamed"),
      });
      void load(1, "");
    },
    [t, load],
  );

  const { connect, isConnecting } = useMercadoLivreConnect(reportResult);
  useConnectRedirectResult(MERCADOLIVRE_ACCOUNTS_PATH, reportResult);

  const connectedCount = accounts.filter((account) => account.status === "CONNECTED").length;
  const attentionCount = accounts.filter((account) => account.needsReconnect).length;

  const columns = useMemo<DashboardTableColumn<MercadoLivreAccount>[]>(
    () => [
      {
        key: "account",
        header: t("list.account"),
        render: (row) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-foreground">{row.nickname}</span>
            <span className="text-xs text-muted-foreground">{t("account.sellerId", { id: row.mlUserId })}</span>
          </div>
        ),
      },
      { key: "status", header: t("list.status"), render: (row) => <StatusCell account={row} /> },
      {
        key: "capabilities",
        header: t("list.capabilities"),
        render: (row) => (
          <div className="flex flex-wrap gap-1">
            {MERCADOLIVRE_CAPABILITIES.map((capability) => (
              <CapabilityChip key={capability} enabled={row[capability]} label={t(`capability.${capability}`)} />
            ))}
          </div>
        ),
      },
      {
        key: "lastHealthCheck",
        header: t("list.lastHealthCheck"),
        render: (row) =>
          row.lastHealthCheckAt ? (
            <span className="text-sm text-foreground">{checkedDate(row.lastHealthCheckAt)}</span>
          ) : (
            <EmptyValue />
          ),
      },
    ],
    [t, checkedDate],
  );

  const renderRowActions = useCallback(
    (row: MercadoLivreAccount) => (
      <div className="flex items-center gap-1">
        {reconnectable(row) && canCreate ? (
          <button
            type="button"
            disabled={isConnecting}
            onClick={(event) => {
              event.stopPropagation();
              connect(MERCADOLIVRE_ACCOUNTS_PATH);
            }}
            title={t("list.reconnect")}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-destructive-ink transition-colors hover:bg-muted disabled:opacity-50"
          >
            <ArrowClockwise className={cn("h-3.5 w-3.5", isConnecting && "animate-spin")} weight="bold" />
            {t("list.reconnect")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            router.push(mercadoLivreAccountPath(row.id));
          }}
          title={t("list.view")}
          aria-label={t("list.view")}
          className="inline-flex items-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Eye className="h-4 w-4" />
        </button>
        {canDelete && row.status !== "DISCONNECTED" ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setDisconnecting(row);
            }}
            title={t("list.disconnect")}
            aria-label={t("list.disconnect")}
            className="inline-flex items-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive-ink"
          >
            <Trash className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    ),
    [canCreate, canDelete, connect, isConnecting, router, t],
  );

  const connectButton = canCreate ? (
    <Link href={MERCADOLIVRE_CONNECT_PATH}>
      <Button variant="primary" title={t("list.connect")} icon={<Plus weight="bold" className="h-4 w-4" />} iconVisible iconSide="left" />
    </Link>
  ) : undefined;

  return (
    <div className="w-full space-y-6">
      <DashboardPageHeader
        badge={t("screens.accounts.title")}
        description={t("screens.accounts.description")}
        icon={<MercadoLivreLogoColor className="h-6 w-6" />}
        actions={connectButton}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-[--radius] border border-border bg-card px-5 py-3 shadow-sm">
        <div className="relative w-full max-w-xs">
          <ElevatedInput
            type="text"
            label={t("list.searchPlaceholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void load(1, search);
            }}
            icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
            controlSize="sm"
            className="w-full"
          />
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-4">
          <ChannelListStat label={t("list.stats.total")} value={loading ? "…" : totalItems} />
          <ChannelListStat label={t("list.stats.connected")} value={loading ? "…" : connectedCount} />
          <ChannelListStat label={t("list.stats.attention")} value={loading ? "…" : attentionCount} />
        </div>
        <Button
          variant="ghost"
          title=""
          icon={<ArrowClockwise weight="bold" className={cn("h-4 w-4", loading && "animate-spin")} />}
          iconVisible
          iconSide="left"
          onClick={() => void load(page, search)}
          disabled={loading}
        />
        {!loading && <span className="whitespace-nowrap text-xs text-muted-foreground">{t("list.total", { total: totalItems })}</span>}
      </div>

      {error ? <Notice tone="fault">{error}</Notice> : null}

      {!loading && attentionCount > 0 ? (
        <Notice tone="fault" title={t("notice.reconnectTitle")}>
          <p>{t("list.attentionNotice", { count: attentionCount })}</p>
        </Notice>
      ) : null}

      {loading ? (
        <DashboardTable<MercadoLivreAccount> data={[]} columns={columns} rowKey={(row) => row.id} loading />
      ) : accounts.length === 0 ? (
        <DashboardTable<MercadoLivreAccount>
          data={[]}
          columns={columns}
          rowKey={(row) => row.id}
          emptyState={{
            icon: <MercadoLivreLogoColor className="h-7 w-7" />,
            title: t("list.emptyTitle"),
            description: t("list.emptyDescription"),
            action: connectButton ? <div className="mt-2 flex items-center gap-3">{connectButton}</div> : undefined,
          }}
        />
      ) : (
        <div className="space-y-4">
          <ElevatedContainer className="overflow-hidden rounded-lg border border-border !p-0">
            <DashboardTable<MercadoLivreAccount>
              data={accounts}
              columns={columns}
              rowKey={(row) => row.id}
              onRowClick={(row) => router.push(mercadoLivreAccountPath(row.id))}
              renderRowActions={renderRowActions}
              className="rounded-none border-0 shadow-none"
            />
          </ElevatedContainer>
          <ChannelListPagination
            page={page}
            totalPages={totalPages}
            loading={loading}
            labels={{
              pageOf: t("list.pageOf", { page, totalPages }),
              previous: t("list.previous"),
              next: t("list.next"),
            }}
            onPage={(next) => void load(next, search)}
          />
        </div>
      )}

      <MercadoLivreDisconnectDialog
        account={disconnecting}
        open={disconnecting !== null}
        onOpenChange={(open) => {
          if (!open) setDisconnecting(null);
        }}
        onDisconnected={() => {
          setDisconnecting(null);
          void load(page, search);
        }}
      />
    </div>
  );
}
